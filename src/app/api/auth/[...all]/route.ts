import type { NextRequest } from "next/server";
import { getAuth, googleAuthConfigured } from "@/lib/auth/server";
import { EnvironmentConfigurationError } from "@/lib/config/env";

export const runtime = "nodejs";
async function handle(request: NextRequest) {
  try {
    if (!googleAuthConfigured()) {
      if (request.nextUrl.pathname === "/api/auth/get-session") return Response.json(null, { headers: { "Cache-Control": "no-store" } });
      return unavailable();
    }
    return getAuth().handler(request);
  } catch (error) {
    if (!(error instanceof EnvironmentConfigurationError)) throw error;
    // Do not send environment names or values to the browser.
    console.error(error.message);
    return unavailable();
  }
}
function unavailable() {
  return Response.json({ code: "AUTH_NOT_CONFIGURED", message: "Google 로그인 준비 중입니다. 잠시 후 다시 시도해 주세요." },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}
export { handle as GET, handle as POST };
