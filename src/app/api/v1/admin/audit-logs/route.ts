import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { listAdminAuditLogs } from "@/server/services/admin-service";
import { handleApiRequest, ok } from "@/lib/utils/http";
export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    await requireAdmin(request);
    return ok(await listAdminAuditLogs(Object.fromEntries(request.nextUrl.searchParams)));
  });
}
