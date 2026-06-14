import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth code-exchange handler.
 *
 * Supabase redirects here after Google sign-in with a `code` query param.
 * We exchange it for a session, which @supabase/ssr writes to cookies, then
 * redirect the user into the app. This is the one Next.js route handler we use
 * — it exists solely for the cookie-based auth flow, not for application data.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error, send the user back to the landing page.
  return NextResponse.redirect(`${origin}/`);
}
