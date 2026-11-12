import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Network-boundary proxy (Next.js 16 replacement for middleware).
 *  - Supabase mode: refreshes the auth session cookie on every request.
 *  - Both modes: optimistic redirect of signed-out visitors away from app routes.
 * This is only a fast first gate: every page, action and route handler still
 * verifies the session on the server before touching data.
 */

const PROTECTED_PREFIXES = [
  "/overview",
  "/transfer",
  "/airtime",
  "/bills",
  "/betting",
  "/transactions",
  "/beneficiaries",
  "/cards",
  "/settings",
  "/receipt",
  "/api/transactions",
];

const LOCAL_SESSION_COOKIE = "eleos_session";

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseMode = !!url && !!key && process.env.ELEOS_DATA_MODE !== "local";

  let signedIn: boolean;
  if (supabaseMode) {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims;
  } else {
    signedIn = request.cookies.has(LOCAL_SESSION_COOKIE);
  }

  if (!signedIn && isProtected(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const target = request.nextUrl.clone();
    target.pathname = "/sign-in";
    target.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
