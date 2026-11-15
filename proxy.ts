import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isStaffRole, rolesForPath } from "@/lib/auth/roles";

// Next.js 16 "proxy" (formerly middleware). Runs before every page request:
// 1. refreshes the Supabase session cookie so Server Components see a fresh token;
// 2. for /admin, /instructor and /review, checks the role (AUTH-5):
//    not signed in → redirect to /login; wrong or no role → HTTP 403.
// The layouts check again on the server (lib/auth/session.ts), and RLS guards the data.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Verifies the JWT and refreshes it when needed. Don't add code between
  // createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const allowed = rolesForPath(request.nextUrl.pathname);
  if (!allowed) return response;

  if (!userId) {
    return withCookies(NextResponse.redirect(new URL("/login", request.url)), response);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !isStaffRole(profile.role) || !allowed.includes(profile.role)) {
    return withCookies(
      NextResponse.rewrite(new URL("/no-access", request.url), { status: 403 }),
      response,
    );
  }

  return response;
}

// Keep refreshed session cookies when we answer with something other than `response`.
function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
