# ReciclApp — Product Requirements Document

**Waste & Recycling Collection Management Platform**  
Version: 1.0 | Date: May 2026

---

## Table of Contents

1. [Purpose & Overview](#1-purpose--overview)
2. [Technology Stack](#2-technology-stack)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Pages](#4-pages)
5. [Backend API Endpoints](#5-backend-api-endpoints)
6. [Data Model](#6-data-model)
7. [Environment Configuration](#7-environment-configuration)
8. [Non-Functional Requirements](#8-non-functional-requirements)

---

## 1. Purpose & Overview

ReciclApp is a waste collection management web platform for the Dominican Republic. It serves several projects (_proyectos_), each one town with its own pickup points, data and users; the first is Sabana Yegua and its surrounding communities. It enables recycling teams to manage pickup points (PDRs — _Puntos de Recogida_), record weekly collection passes, track plastic weight gathered, and visualize recycling impact through a private analytics dashboard.

The platform is designed for two audiences:

- **Field operators and coordinators** — log collection activity, register new pickup points, and track weekly weights.
- **Project administrators** — manage their project's users, and configure its settings, communities and neighborhoods.
- **Superadmins** — create, archive and delete projects, and manage accounts across all projects.

---

## 2. Technology Stack

| Layer          | Technology                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| Frontend       | Next.js 15, React 18, Material-UI (MUI), MUI X Charts                        |
| Backend        | FastAPI (Python), SQLAlchemy 2.0, Uvicorn, Gunicorn                          |
| Database       | Supabase (PostgreSQL), accessed via direct connection from the backend       |
| Authentication | Supabase Auth with Google OAuth 2.0, cookie-based sessions (`@supabase/ssr`) |
| Maps           | Google Maps API (markers, clustering)                                        |
| Hosting        | Google Cloud App Engine                                                      |

---

## 3. Authentication & Authorization

### 3.1 Auth Flow

1. User clicks "Sign in with Google" on the frontend.
2. Supabase Auth handles the Google OAuth redirect and code exchange.
3. Supabase issues a JWT session stored in cookies via `@supabase/ssr`:
   - Access token: 1-hour expiry
   - Refresh token: refreshed automatically by the Supabase client
4. On each request, the FastAPI backend verifies the Supabase JWT, matches the user in the `users` table by email, and checks their role in the requested town (`town_members`).
5. Logout is handled by the Supabase client, which clears the session cookies.

### 3.2 Role-Based Access Control (RBAC)

Roles apply **per project (town)**: a user can be `write` in one project and `read` in another, and has no access to projects they aren't a member of. Roles are hierarchical — each role inherits all permissions of the roles below it.

| Role    | Access Level (within one project)                                                   |
| ------- | ----------------------------------------------------------------------------------- |
| `read`  | View pickup points, map, and statistics                                             |
| `write` | `read` + create/edit pickup points, record collection passes, manage weight entries |
| `admin` | `write` + the project's users and settings (communities, neighborhoods, lists)      |

**Superadmins** (`users.is_superadmin`) act as `admin` in every project without a membership, and are the only ones who can create, archive, restore and delete projects, or manage accounts (promote superadmins, deactivate). An archived project blocks everyone until a superadmin restores it.

Users choose their project after signing in: one project goes straight in, several show a picker (and a switcher afterwards), none shows a no-access message.

Role enforcement is applied at two layers:

- **Frontend**: `PermissionGuard` component wraps protected pages, checks the role in the selected project, and redirects unauthorized users.
- **Backend**: FastAPI dependencies (`require_town_role`, `require_superadmin`) enforce access per endpoint. A town's data is only reachable through that town's routes.

---

## 4. Pages

### 4.1 Landing Page — `/`

**Access:** Public  
Entry point for unauthenticated users. Describes ReciclApp's purpose and feature set.

---

### 4.2 Info / Help — `/info`

**Access:** Public  
Explains how each section of the app works: List, Map, New Point, Pass Points, and Statistics.

---

### 4.4 List — `/list`

**Access:** `read`  
Displays all registered pickup points in a filterable, searchable data grid. Columns: name, neighborhood, community, category, date added.

---

### 4.5 Map — `/map`

**Access:** `read`  
Interactive Google Map showing all pickup points as clustered markers. Clicking a marker displays point details. Supports filtering by neighborhood and category.

---

### 4.6 Dashboard — `/dashboard`

**Access:** `read`  
Private analytics dashboard:

- Collection time series by neighborhood (line chart)
- Neighborhood distribution (pie chart)
- Weekly weight by plastic type (bar chart)
- Waste percentage breakdown
- Recently added pickup points

---

### 4.6a Collection Status — `/collection-status`

**Access:** `read`  
Read-only view of a selected week's collection pass, grouped by
neighborhood. Lets a supervisor check, without editing, which PDRs have been
collected (and with what status) for any week. Defaults to the current ISO
week; a week can be paged with previous/next controls, same as Collection
Pass. Each neighborhood is shown collapsed with a collected/total count next
to its name, expanding to list every PDR in it with its recorded status
(`collected` / `empty` / `unavailable` / `closed`, or unrecorded).

---

### 4.7 Weight Tracking — `/weights`

**Access:** `write`  
Weekly form to record plastic collected by weight category (PET, HDPE, PP, trash). Inline data grid with create, edit, and delete capabilities.

---

### 4.8 New Pickup Point — `/new-pdr`

**Access:** `write`  
Form to register a new PDR. Includes an embedded map picker for selecting coordinates, and fields for name, description, neighborhood, community, and category.

---

### 4.9 Collection Pass — `/collection-pass`

**Access:** `write`  
Weekly collection pass recording. Lists all active pickup points; the operator marks each as one of:

- `collected` — plastic found and collected
- `empty` — no plastic found
- `unavailable` — point unavailable
- `closed` — point closed

Records are keyed by ISO week (YYYYWW).

---

### 4.10 Admin Panel — `/admin`

**Access:** `admin` in the selected project  
Tabs:

- **Users**: the project's members. Add people by email (creating the account if needed), change their role (`read` / `write` / `admin`), or remove them from the project. Admins cannot change or remove their own access.
- **Project settings**: name, map center and zoom, categories, plastic types, report text, and communities with nested barrios.
- **Projects** (superadmins only): create, archive, restore and delete projects. Only projects with no data can be deleted.
- **Accounts** (superadmins only): promote or demote superadmins, deactivate accounts (blocks access to every project). Superadmins cannot change their own superadmin access or deactivate themselves.

---

## 5. Backend API Endpoints

All endpoints are relative to the API base URL. Auth-protected endpoints require valid session cookies.

### 5.1 Authentication

Login, logout, and token refresh are handled directly by the Supabase client — they do not go through the FastAPI backend. The backend exposes one auth-related endpoint:

| Method | Endpoint   | Auth Required | Description                                       |
| ------ | ---------- | ------------- | ------------------------------------------------- |
| `GET`  | `/auth/me` | JWT           | Current user, `is_superadmin`, and their towns with their role in each |

Town-owned data lives under `/towns/{town_id}`. Each role in the tables below is the caller's role **in that town** (superadmins pass as `admin`). An ID from another town is not found.

### 5.2 Pickup Points (PDRs)

| Method   | Endpoint                               | Role    | Description                                   |
| -------- | -------------------------------------- | ------- | --------------------------------------------- |
| `GET`    | `/towns/{town_id}/pdrs`                | `read`  | List the town's pickup points                 |
| `GET`    | `/towns/{town_id}/pdrs/with-history`   | `read`  | Pickup points with their last 5 weeks' status |
| `GET`    | `/towns/{town_id}/pdrs/{id}`           | `read`  | Get a single pickup point                     |
| `POST`   | `/towns/{town_id}/pdrs`                | `write` | Create a pickup point (by `neighborhood_id`)  |
| `PUT`    | `/towns/{town_id}/pdrs/{id}`           | `write` | Update a pickup point                         |
| `DELETE` | `/towns/{town_id}/pdrs/{id}`           | `write` | Soft-delete a pickup point                    |

### 5.3 Collections (Recogida)

| Method | Endpoint                                      | Role    | Description                           |
| ------ | --------------------------------------------- | ------- | ------------------------------------- |
| `GET`  | `/towns/{town_id}/collections/current`        | `read`  | Current ISO year and week             |
| `GET`  | `/towns/{town_id}/collections/{year}/{week}`  | `read`  | All PDR statuses for a given ISO week |
| `POST` | `/towns/{town_id}/collections/{year}/{week}`  | `write` | Save collection pass for a week       |

### 5.4 Weights and Dashboard

| Method   | Endpoint                             | Role    | Description                                         |
| -------- | ------------------------------------ | ------- | --------------------------------------------------- |
| `GET`    | `/towns/{town_id}/weights`           | `read`  | The town's weight entries                           |
| `POST`   | `/towns/{town_id}/weights`           | `write` | Create a weight entry (type from the town's list)   |
| `PUT`    | `/towns/{town_id}/weights/{id}`      | `write` | Update a weight entry                               |
| `DELETE` | `/towns/{town_id}/weights/{id}`      | `write` | Delete a weight entry                               |
| `GET`    | `/towns/{town_id}/dashboard/stats`   | `read`  | Dashboard statistics for the town                   |

### 5.5 Members and Accounts

| Method   | Endpoint                                | Role         | Description                                                    |
| -------- | --------------------------------------- | ------------ | -------------------------------------------------------------- |
| `GET`    | `/towns/{town_id}/members`              | `admin`      | The town's members and roles                                   |
| `POST`   | `/towns/{town_id}/members`              | `admin`      | Add a user by email (creates the account if needed)            |
| `PUT`    | `/towns/{town_id}/members/{user_id}`    | `admin`      | Change a member's role (not one's own)                         |
| `DELETE` | `/towns/{town_id}/members/{user_id}`    | `admin`      | Remove a member from the town (not oneself)                    |
| `GET`    | `/users`                                | superadmin   | List all accounts                                              |
| `PUT`    | `/users/{email}`                        | superadmin   | Rename an account or set `is_superadmin`                       |
| `DELETE` | `/users/{email}`                        | superadmin   | Deactivate an account (not one's own)                          |

### 5.6 Towns (Projects)

| Method   | Endpoint                                   | Role         | Description                                        |
| -------- | ------------------------------------------ | ------------ | -------------------------------------------------- |
| `GET`    | `/towns`                                   | JWT          | The caller's towns (all for superadmins)           |
| `GET`    | `/towns/{town_id}`                         | `read`       | Town settings with communities and neighborhoods   |
| `PUT`    | `/towns/{town_id}`                         | `admin`      | Update the town's settings                         |
| `POST`   | `/towns/{town_id}/communities`             | `admin`      | Add a community                                    |
| `PUT`    | `/communities/{id}`, `/neighborhoods/{id}` | `admin`      | Rename (authorized against the row's own town)     |
| `DELETE` | `/communities/{id}`, `/neighborhoods/{id}` | `admin`      | Delete, unless pickup points use it (409)          |
| `POST`   | `/communities/{id}/neighborhoods`          | `admin`      | Add a neighborhood                                 |
| `POST`   | `/towns`                                   | superadmin   | Create a town                                      |
| `POST`   | `/towns/{town_id}/archive`, `/restore`     | superadmin   | Archive or restore a town                          |
| `DELETE` | `/towns/{town_id}`                         | superadmin   | Delete a town with no data (409 otherwise)         |

---

## 6. Data Model

PostgreSQL tables (hosted on Supabase):

| Table           | Purpose                           | Key Fields                                                                                       |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `towns`          | Projects and their settings        | `id`, `name`, `map_center_lat`, `map_center_lng`, `map_zoom`, `categories`, `plastic_types`, `report_partner_text`, `archived_at` |
| `communities`    | Communities within a town          | `id`, `town_id` (FK), `name`                                                                     |
| `neighborhoods`  | Neighbourhoods within a community  | `id`, `community_id` (FK), `name`                                                                |
| `pdrs`           | Pickup points                      | `id`, `internal_id`, `name`, `town_id` (FK), `neighborhood_id` (FK), `category`, `lat`, `lng`, `created_at`, `deleted_at` |
| `collections`    | Weekly collection records          | `id`, `pdr_id` (FK), `year`, `week`, `status` (collected / empty / unavailable / closed), `date` |
| `weight_entries` | Weight entries                     | `id`, `town_id` (FK), `date`, `plastic_type`, `weight_lbs`                                       |
| `users`          | Accounts                           | `id`, `email`, `name`, `is_superadmin`, `created_at`, `created_by`, `deleted_at`                 |
| `town_members`   | A user's role in one town          | `user_id` (FK), `town_id` (FK), `role` (read / write / admin)                                    |
| `activity_logs`  | Audit trail of mutating actions    | `id`, `user_id` (FK), `town_id` (FK, null for global actions), `action`, `resource_type`, `resource_id`, `resource_name`, `created_at` |

> A PDR's community comes from its neighborhood. Collections belong to a town through their PDR. `users` are matched to Supabase Auth identities by email; they are not linked to `auth.users` by id.

---

## 7. Environment Configuration

Two environments with per-environment configuration:

| Environment | Frontend          | Backend               |
| ----------- | ----------------- | --------------------- |
| Development | `localhost:3000`  | `localhost:8000`      |
| Production  | `reciclaplus.com` | `api.reciclaplus.com` |

Each environment uses its own Supabase project, keeping development and production data fully isolated.

Per-environment variables: Supabase project URL and keys, Google OAuth client credentials, OAuth redirect URI, CORS allowed origins, and cookie security flags (`Secure`, `SameSite`).

For pre-production testing of risky changes, use App Engine versions with traffic splitting rather than a standing staging environment.

---

## 8. Non-Functional Requirements

- **Security**: Auth sessions are cookie-based via `@supabase/ssr` — tokens are never stored in `localStorage`. API requests authenticate with a short-lived bearer token obtained from the Supabase session.
- **CORS**: Strictly whitelisted per environment; no wildcard origins in production.
- **Audit logging**: All important user actions (creating, updating, or deleting PDRs, recording collection passes, managing users, and weight entries) are logged to an `activity_logs` table with the user, action type, affected resource, and timestamp.
- **Dual enforcement**: Role-based access is enforced at both the frontend (component level) and backend (API level) independently.
- **Single source of truth**: Supabase (PostgreSQL) is the only database and storage layer. No external file storage is used.
- **Stateless backend**: The FastAPI backend is stateless — session state lives in signed cookies, not server memory.
- **Responsive design**: The UI must be fully usable on mobile devices. Layouts, tables, and forms should adapt to small screens.
- **User experience**: The interface should be clean, modern, and intuitive — minimal friction for field operators who may be non-technical users accessing the app on a phone.
- **Code quality**: Code should follow established best practices for both Next.js (frontend) and FastAPI (backend) — clear separation of concerns, consistent naming, and no unnecessary complexity.
- **Testability**: Business logic should be structured to be unit-testable. Critical backend endpoints should have integration tests.
- **Documentation**: Public functions, API endpoints, and non-obvious logic should be documented. The API should have auto-generated OpenAPI docs (provided by FastAPI by default).
