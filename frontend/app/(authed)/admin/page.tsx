"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { PermissionGuard } from "@/components/PermissionGuard";
import { UsersTab } from "@/components/admin/UsersTab";
import { TownConfigTab } from "@/components/admin/TownConfigTab";
import { strings } from "@/lib/strings";

function AdminPanel() {
  const [tab, setTab] = useState(0);

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.admin.title}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={strings.admin.tabUsers} />
          <Tab label={strings.admin.tabTowns} />
        </Tabs>
      </Box>

      {tab === 0 && <UsersTab />}
      {tab === 1 && <TownConfigTab />}
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
