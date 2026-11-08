"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { AccountsTab } from "@/components/admin/AccountsTab";
import { MembersTab } from "@/components/admin/MembersTab";
import { ProjectsTab } from "@/components/admin/ProjectsTab";
import { TownSettingsTab } from "@/components/admin/TownSettingsTab";
import { useAuth } from "@/lib/auth-context";
import { strings } from "@/lib/strings";

type AdminTab = "members" | "settings" | "projects" | "accounts";

/**
 * Admin panel for the selected project: its users and settings. Superadmins
 * also get the global tabs for all projects and all accounts. The backend
 * enforces each of these independently.
 */
function AdminPanel() {
  const { user } = useAuth();
  const isSuperadmin = !!user?.is_superadmin;
  const [tab, setTab] = useState<AdminTab>("members");

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.admin.title}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v: AdminTab) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="members" label={strings.admin.tabUsers} />
          <Tab value="settings" label={strings.admin.tabTowns} />
          {isSuperadmin && <Tab value="projects" label={strings.admin.tabProjects} />}
          {isSuperadmin && <Tab value="accounts" label={strings.admin.tabAccounts} />}
        </Tabs>
      </Box>

      {tab === "members" && <MembersTab />}
      {tab === "settings" && <TownSettingsTab />}
      {isSuperadmin && tab === "projects" && <ProjectsTab />}
      {isSuperadmin && tab === "accounts" && <AccountsTab />}
    </Stack>
  );
}

export default function AdminPage() {
  return (
    <PermissionGuard minimum="admin">
      <AdminPanel />
    </PermissionGuard>
  );
}
