import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code"),
    token = params.get("token_hash"),
    type = params.get("type");
  const auth = (await createClient()).auth;
  const recovery = type === "recovery" || params.get("flow") === "recovery";
  let confirmed = false;
  if (code) confirmed = !(await auth.exchangeCodeForSession(code)).error;
  else if (
    token &&
    (type === "signup" || type === "email" || type === "recovery")
  )
    confirmed = !(await auth.verifyOtp({ type, token_hash: token })).error;
  const path = confirmed
    ? recovery
      ? "/reset-password"
      : "/dashboard"
    : "/auth/link-expired";
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
