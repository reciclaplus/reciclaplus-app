"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/Home";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MapIcon from "@mui/icons-material/Map";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import RecyclingIcon from "@mui/icons-material/Recycling";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hasRole, type Role } from "@/lib/roles";
import { strings } from "@/lib/strings";

const DRAWER_WIDTH = 240;

interface NavItem {
  href: string;
  label: string;
  minimum: Role;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: strings.nav.home, minimum: "read", icon: <HomeIcon /> },
  { href: "/list", label: strings.nav.list, minimum: "read", icon: <ListAltIcon /> },
  { href: "/map", label: strings.nav.map, minimum: "read", icon: <MapIcon /> },
  { href: "/new-pdr", label: strings.nav.newPdr, minimum: "write", icon: <AddLocationAltIcon /> },
];

/**
 * App shell for authenticated pages: a left navigation drawer (persistent on
 * desktop, temporary on mobile) with role-filtered links + sign-out, and a top
 * bar carrying the app title and the mobile menu button.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => hasRole(user?.role, item.minimum));

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ gap: 1 }}>
        <RecyclingIcon color="primary" />
        <Typography variant="h6" noWrap>
          {strings.appName}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {items.map((item) => (
          <ListItem key={item.href} disablePadding>
            <ListItemButton
              component={Link}
              href={item.href}
              selected={pathname === item.href}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary={strings.nav.signOut} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      {/* Top bar — only needed for the menu button + title on mobile. */}
      <AppBar
        position="fixed"
        sx={{
          display: { sm: "none" },
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label={strings.nav.menu}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
          <RecyclingIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap>
            {strings.appName}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Navigation drawers. */}
      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content. */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        {/* Spacer to clear the fixed mobile AppBar. */}
        <Toolbar sx={{ display: { sm: "none" } }} />
        {children}
      </Box>
    </Box>
  );
}
