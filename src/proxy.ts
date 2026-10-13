import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/readings/:path*", "/me/:path*", "/admin/:path*"]
};
