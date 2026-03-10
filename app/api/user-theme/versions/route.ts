import { getUserIdFromRequest } from "@/lib/server/user-session";
import { listUserThemeVersionsDetailed } from "@/lib/server/theme-store";

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const versions = await listUserThemeVersionsDetailed(userId);
  return Response.json({ versions });
}
