import { AuthProvider } from "@/lib/auth-context";
import { TownProvider } from "@/lib/town-context";
import { AppShell } from "@/components/AppShell";

/**
 * Layout for all authenticated pages: provides the current user (via
 * /auth/me), the selected town, and the navigation shell.
 */
export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TownProvider>
        <AppShell>{children}</AppShell>
      </TownProvider>
    </AuthProvider>
  );
}
