export type ApiResponse<T> = {
  success: true;
  data: T;
  meta: { requestId: string };
} | {
  success: false;
  error: { code: string; message: string; details: unknown };
  meta: { requestId: string };
};
