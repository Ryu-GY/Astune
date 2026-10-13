import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ZodError } from "zod";
import { DomainError } from "@/lib/readings/errors";

export function toApiErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ ok: false, error: {
      code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.",
      details: error instanceof ZodError ? error.flatten() : null
    } }, { status: 400 });
  }
  if (error instanceof DomainError) {
    return NextResponse.json({ ok: false, error: {
      code: error.code, message: error.message, details: error.details ?? null
    } }, { status: error.status });
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null
        }
      },
      { status: error.statusCode }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "서버 내부 오류가 발생했습니다."
      }
    },
    { status: 500 }
  );
}
