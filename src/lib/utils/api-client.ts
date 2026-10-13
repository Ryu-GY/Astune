import type { ApiResponse } from "@/types/api";
export class ApiClientError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function apiClient<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json() as ApiResponse<T>;
  if (!response.ok || !body.success) throw new ApiClientError(!body.success ? body.error.message : "요청을 처리하지 못했어요.", response.status);
  return body.data;
}
export function postJson(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
