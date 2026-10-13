import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getAuth, googleAuthConfigured } from "./server";

export type RequestSession = { userId: string; email: string; role: "USER" | "ADMIN" };

export async function getRequestSession(request: NextRequest): Promise<RequestSession | null> {
  let userId: string | undefined;
  if (googleAuthConfigured()) {
    const session = await getAuth().api.getSession({ headers: request.headers });
    userId = session?.user.id;
  }
  if (!userId && process.env.NODE_ENV !== "production" && process.env.ASTUNE_ALLOW_DEV_AUTH === "1") {
    userId = request.headers.get("x-user-id") || undefined;
  }
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  return user ? { userId: user.id, email: user.email, role: user.role } : null;
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigin = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== allowedOrigin)) {
    throw new AppError("허용되지 않은 요청입니다.", { statusCode: 403, code: "ORIGIN_NOT_ALLOWED" });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AppError("JSON 형식으로 요청해 주세요.", { statusCode: 415, code: "JSON_REQUIRED" });
  }
}

export async function requireUser(request: NextRequest): Promise<RequestSession> {
  const session = await getRequestSession(request);
  if (!session) throw new AppError("로그인이 필요합니다.", { statusCode: 401, code: "AUTH_REQUIRED" });
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) requireSameOrigin(request);
  return session;
}

export async function requireAdmin(request: NextRequest): Promise<RequestSession & { role: "ADMIN" }> {
  const session = await requireUser(request);
  if (session.role !== "ADMIN") throw new AppError("관리자 권한이 필요합니다.", { statusCode: 403, code: "ADMIN_REQUIRED" });
  return { ...session, role: "ADMIN" };
}
