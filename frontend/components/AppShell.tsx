"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import RecyclingIcon from "@mui/icons-material/Recycling";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hasRole, type Role } from "@/lib/roles";
import { strings } from "@/lib/strings";

interface NavItem {
  href: string;
  label: string;
  minimum: Role;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: strings.nav.home, minimum: "read" },
  { href: "/new-pdr", label: strings.nav.newPdr, minimum: "write" },
];

/**
 * App shell for authenticated pages: top bar with role-filtered navigation
 * (inline on desktop, drawer on mobile) and sign-out.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => hasRole(user?.role, item.minimum));

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 1, display: { sm: "none" } }}
            aria-label={strings.nav.menu}
          >
            <MenuIcon />
          </IconButton>
          <RecyclingIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {strings.appName}
          </Typography>
          <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 1 }}>
            {items.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                color="inherit"
                variant={pathname === item.href ? "outlined" : "text"}
              >
                {item.label}
              </Button>
            ))}
            <Button color="inherit" onClick={handleSignOut}>
              {strings.nav.signOut}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 240 }} role="navigation">
          <List>
            {items.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname === item.href}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={handleSignOut}>
              <ListItemText primary={strings.nav.signOut} />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="md" sx={{ py: 3 }}>
        {children}
      </Container>
    </>
  );
}
