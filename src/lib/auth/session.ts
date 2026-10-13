import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { env } from "@/lib/config/env";

export type RequestSession = {
  userId: string | null;
  email: string | null;
  role: "USER" | "ADMIN" | null;
};

export function getRequestSession(request: NextRequest): RequestSession {
  if (process.env.NODE_ENV === "production" || process.env.ASTUNE_ALLOW_DEV_AUTH !== "1") {
    return { userId: null, email: null, role: null };
  }
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const headerRole = request.headers.get("x-user-role");

  const role =
    headerRole === "ADMIN" ||
    (email && email.toLowerCase() === env.adminBootstrapEmail.toLowerCase())
      ? "ADMIN"
      : userId || email
        ? "USER"
        : null;

  return {
    userId,
    email,
    role
  };
}

export function requireUser(request: NextRequest): RequestSession & { userId: string } {
  const session = getRequestSession(request);

  if (!session.userId) {
    throw new AppError("로그인이 필요합니다.", {
      statusCode: 401,
      code: "AUTH_REQUIRED"
    });
  }

  return { ...session, userId: session.userId };
}

export function requireAdmin(request: NextRequest): RequestSession & { userId: string; role: "ADMIN" } {
  const session = getRequestSession(request);

  if (session.role !== "ADMIN") {
    throw new AppError("관리자 권한이 필요합니다.", {
      statusCode: 403,
      code: "ADMIN_REQUIRED"
    });
  }

  if (!session.userId) {
    throw new AppError("개발용 관리자 헤더 x-user-id가 필요합니다.", {
      statusCode: 401,
      code: "ADMIN_USER_ID_REQUIRED"
    });
  }

  return { ...session, userId: session.userId, role: "ADMIN" };
}
