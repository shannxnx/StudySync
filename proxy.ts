import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const cookieUpdates: Parameters<SetAllCookies>[0] = [];
  const responseHeaders = new Headers();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(updates, cacheHeaders) {
          // Server Components receive the refreshed session on this same request.
          for (const { name, value } of updates) {
            request.cookies.set(name, value);
          }
          cookieUpdates.push(...updates);
          for (const [name, value] of Object.entries(cacheHeaders)) {
            responseHeaders.set(name, value);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (
    (path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/reset-password") &&
    !data?.claims.sub
  ) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    for (const { name, value, options } of cookieUpdates)
      redirect.cookies.set(name, value, options);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  if (cookieUpdates.length === 0) return NextResponse.next();

  const response = NextResponse.next({
    request: { headers: request.headers },
    headers: responseHeaders,
  });
  for (const { name, value, options } of cookieUpdates) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif)$).*)",
  ],
};
