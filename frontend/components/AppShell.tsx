"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import HomeIcon from "@mui/icons-material/Home";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MapIcon from "@mui/icons-material/Map";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import RecyclingIcon from "@mui/icons-material/Recycling";
import ScaleIcon from "@mui/icons-material/Scale";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hasRole, type Role } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";

const SIDEBAR_WIDTH = 236;

interface NavItem {
  href: string;
  label: string;
  minimum: Role;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: strings.nav.home, minimum: "read", icon: <HomeIcon fontSize="small" /> },
  { href: "/list", label: strings.nav.list, minimum: "read", icon: <ListAltIcon fontSize="small" /> },
  { href: "/map", label: strings.nav.map, minimum: "read", icon: <MapIcon fontSize="small" /> },
  { href: "/dashboard", label: strings.nav.dashboard, minimum: "read", icon: <DashboardIcon fontSize="small" /> },
];

const NAV_ITEMS_SECONDARY: NavItem[] = [
  { href: "/new-pdr", label: strings.nav.newPdr, minimum: "write", icon: <AddLocationAltIcon fontSize="small" /> },
  { href: "/collection-pass", label: strings.nav.collectionPass, minimum: "write", icon: <PlaylistAddCheckIcon fontSize="small" /> },
  { href: "/weights", label: strings.nav.weights, minimum: "write", icon: <ScaleIcon fontSize="small" /> },
  { href: "/admin", label: strings.nav.admin, minimum: "admin", icon: <AdminPanelSettingsIcon fontSize="small" /> },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/home", label: strings.nav.home, minimum: "read", icon: <HomeIcon /> },
  { href: "/collection-pass", label: strings.nav.collectionPass, minimum: "write", icon: <PlaylistAddCheckIcon /> },
  { href: "/dashboard", label: strings.nav.dashboard, minimum: "read", icon: <DashboardIcon /> },
  { href: "/map", label: strings.nav.map, minimum: "read", icon: <MapIcon /> },
];

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Box
      component={Link}
      href={item.href}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: "12px",
        textDecoration: "none",
        color: "rgba(255,255,255,.82)",
        fontSize: 14,
        fontWeight: active ? 800 : 600,
        bgcolor: active ? "rgba(255,255,255,.16)" : "transparent",
        transition: "background-color 150ms ease",
        "&:hover": { bgcolor: "rgba(255,255,255,.12)" },
        ...(active && { color: "#fff" }),
      }}
    >
      {item.icon}
      <Typography component="span" sx={{ fontSize: 14, fontWeight: "inherit" }}>
        {item.label}
      </Typography>
    </Box>
  );
}

/**
 * App shell for authenticated pages: a persistent emerald sidebar nav on
 * desktop (>=900px), a bottom tab bar on mobile, role-filtered links, and a
 * user card with sign-out.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const items = NAV_ITEMS.filter((item) => hasRole(user?.role, item.minimum));
  const secondaryItems = NAV_ITEMS_SECONDARY.filter((item) => hasRole(user?.role, item.minimum));
  const mobileTabs = MOBILE_TABS.filter((item) => hasRole(user?.role, item.minimum));

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  const sidebar = (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: "100dvh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(175deg, ${COLORS.emeraldStart}, ${COLORS.emeraldEnd})`,
        color: "#fff",
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", px: 1, py: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            bgcolor: COLORS.lime,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <RecyclingIcon sx={{ color: COLORS.emeraldEnd, fontSize: 20 }} />
        </Box>
        <Typography sx={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-display)" }}>
          {strings.appName}
        </Typography>
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 1, flexGrow: 1, overflowY: "auto" }}>
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}
        {secondaryItems.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,.18)", my: 1 }} />
            {secondaryItems.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} />
            ))}
          </>
        )}
      </Stack>

      {user && (
        <Box
          sx={{
            bgcolor: "rgba(255,255,255,.12)",
            borderRadius: "14px",
            p: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          <Avatar sx={{ width: 34, height: 34, bgcolor: COLORS.lime, color: COLORS.emeraldDeepest, fontWeight: 800, fontSize: 14 }}>
            {initial}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {user.name ?? user.email}
            </Typography>
            <Typography noWrap sx={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>
              {strings.roles[user.role]}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleSignOut} aria-label={strings.nav.signOut} sx={{ color: "rgba(255,255,255,.85)" }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      {isDesktop && sidebar}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          minWidth: 0,
          p: { xs: 2, sm: 3, md: 4 },
          pb: { xs: 10, md: 4 },
        }}
      >
        {children}
      </Box>

      {!isDesktop && (
        <Box
          component="nav"
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            bgcolor: COLORS.emeraldEnd,
            boxShadow: "0 -2px 10px rgba(0,0,0,.12)",
            zIndex: (t) => t.zIndex.appBar,
            py: 0.75,
          }}
        >
          {mobileTabs.map((item) => {
            const active = pathname === item.href;
            return (
              <Box
                key={item.href}
                component={Link}
                href={item.href}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.25,
                  minWidth: 56,
                  minHeight: 44,
                  justifyContent: "center",
                  textDecoration: "none",
                  color: active ? COLORS.lime : "rgba(255,255,255,.75)",
                  px: 1,
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: 11, fontWeight: active ? 800 : 600, color: "inherit" }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
