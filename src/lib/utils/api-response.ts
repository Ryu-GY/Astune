import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestId } from "./request-context";

export function apiResponse(body: object, status: number) {
  const requestId = getRequestId() ?? randomUUID();
  return NextResponse.json({ ...body, meta: { requestId } }, {
    status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" }
  });
}
