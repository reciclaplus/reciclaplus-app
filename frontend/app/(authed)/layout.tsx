import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

/**
 * Layout for all authenticated pages: provides the current user (via
 * /auth/me) and the navigation shell.
 */
export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
