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

ReciclApp is a waste collection management web platform for the Dominican Republic, initially serving Sabana Yegua and surrounding communities. It enables recycling teams to manage pickup points (PDRs — *Puntos de Recogida*), record weekly collection passes, track plastic weight gathered, and expose public-facing statistics on recycling impact.

The platform is designed for two audiences:
- **Field operators and coordinators** — log collection activity, register new pickup points, and track weekly weights.
- **Administrators** — manage users, configure towns and neighborhoods, and oversee the full dataset.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18, Material-UI (MUI), MUI X Charts |
| Backend | FastAPI (Python), Uvicorn, Gunicorn |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth with Google OAuth 2.0, HTTP-only cookie sessions |
| Maps | Google Maps API (markers, clustering) |
| Hosting | Google Cloud App Engine |

---

## 3. Authentication & Authorization

### 3.1 Auth Flow

1. User clicks "Sign in with Google" on the frontend.
2. Supabase Auth handles the Google OAuth redirect and code exchange.
3. Supabase issues a JWT session stored in HTTP-only cookies via `@supabase/ssr`:
   - Access token: 1-hour expiry
   - Refresh token: refreshed automatically by the Supabase client
4. On each request, the FastAPI backend verifies the Supabase JWT and fetches the user's role from the `users` table.
5. Logout is handled by the Supabase client, which clears the session cookies.

### 3.2 Role-Based Access Control (RBAC)

Roles are hierarchical — each role inherits all permissions of the roles below it.

| Role | Access Level |
|---|---|
| `read` | View pickup points, map, and statistics |
| `write` | `read` + create/edit pickup points, record collection passes, manage weight entries |
| `admin` | `write` + user management, town and neighborhood configuration |

Role enforcement is applied at two layers:
- **Frontend**: `PermissionGuard` component wraps protected pages and redirects unauthorized users.
- **Backend**: FastAPI dependency injection enforces role requirements per endpoint.

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

**Access:** `admin`  
Two-tab panel:

- **Users tab**: Create, view, edit, and delete platform users. Assign roles (`read` / `write` / `admin`). Admins cannot delete their own account.
- **Town Details tab**: Configure towns — name, map center coordinates, categories list, communities with nested barrios.

---

## 5. Backend API Endpoints

All endpoints are relative to the API base URL. Auth-protected endpoints require valid session cookies.

### 5.1 Authentication

Login, logout, and token refresh are handled directly by the Supabase client — they do not go through the FastAPI backend. The backend exposes one auth-related endpoint:

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/auth/me` | JWT | Return current user's role from the `users` table |

### 5.2 Pickup Points (PDRs)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/pdrs` | `read` | List all pickup points |
| `GET` | `/pdrs/{id}` | `read` | Get a single pickup point |
| `POST` | `/pdrs` | `write` | Create a new pickup point |
| `PUT` | `/pdrs/{id}` | `write` | Update an existing pickup point |
| `DELETE` | `/pdrs/{id}` | `write` | Delete a pickup point |

### 5.3 Collections (Recogida)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/collections` | `read` | Recent collection records (`?limit=n`) |
| `GET` | `/collections/{year}/{week}` | `read` | All PDR statuses for a given ISO week |
| `POST` | `/collections/{year}/{week}` | `write` | Save collection pass for a week |
| `GET` | `/collections/summary` | `read` | Historical records by neighborhood (`?group_by=neighborhood`) |

### 5.4 Weights

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/weights` | `read` | All weight entries |
| `POST` | `/weights` | `write` | Create a weight entry |
| `PUT` | `/weights/{id}` | `write` | Update a weight entry |
| `DELETE` | `/weights/{id}` | `write` | Delete a weight entry |

### 5.5 Users

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/users` | `admin` | List all users |
| `POST` | `/users` | `admin` | Create a user |
| `PUT` | `/users/{email}` | `admin` | Update a user's role or name |
| `DELETE` | `/users/{email}` | `admin` | Delete a user (cannot self-delete) |

### 5.6 Towns

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/towns` | Authenticated | List all towns |
| `GET` | `/towns/{id}` | Authenticated | Get a single town |
| `POST` | `/towns` | `admin` | Create a town |
| `PUT` | `/towns/{id}` | `admin` | Update a town |
| `DELETE` | `/towns/{id}` | `admin` | Delete a town |

---

## 6. Data Model

PostgreSQL tables (hosted on Supabase):

| Table | Purpose | Key Fields |
|---|---|---|
| `pdrs` | Pickup points | `id`, `internal_id`, `name`, `neighborhood`, `community`, `category`, `lat`, `lng`, `created_at` |
| `collections` | Weekly collection records | `id`, `pdr_id` (FK), `year`, `week`, `status` (collected / empty / unavailable / closed), `date` |
| `weights` | Weight entries | `id`, `pet`, `hdpe`, `pp`, `trash`, `date` |
| `users` | Platform users | `id`, `email`, `name`, `role`, `created_at`, `created_by` |
| `towns` | Town configuration | `id`, `name`, `map_center_lat`, `map_center_lng` |
| `communities` | Communities within a town | `id`, `town_id` (FK), `name` |
| `neighborhoods` | Neighbourhoods within a community | `id`, `community_id` (FK), `name` |
| `pdr_logs` | PDR audit trail | `id`, `pdr_id` (FK), `action`, `created_at` |
| `activity_logs` | General user activity audit | `id`, `user_id` (FK), `action`, `resource_type`, `resource_id`, `created_at` |

> `users.id` references Supabase Auth's `auth.users` table, linking platform roles to authenticated identities.

---

## 7. Environment Configuration

Two environments with per-environment configuration:

| Environment | Frontend | Backend |
|---|---|---|
| Development | `localhost:3000` | `localhost:8000` |
| Production | `reciclaplus.com` | `api.reciclaplus.com` |

Each environment uses its own Supabase project, keeping development and production data fully isolated.

Per-environment variables: Supabase project URL and keys, Google OAuth client credentials, OAuth redirect URI, CORS allowed origins, and cookie security flags (`Secure`, `SameSite`).

For pre-production testing of risky changes, use App Engine versions with traffic splitting rather than a standing staging environment.

---

## 8. Non-Functional Requirements

- **Security**: Auth tokens stored in HTTP-only cookies only — never in `localStorage` — to prevent XSS token theft.
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
