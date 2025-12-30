import { getUserIdFromRequest } from "@/lib/server/user-session";
import { listUserThemeVersions } from "@/lib/server/theme-store";

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const versions = await listUserThemeVersions(userId);
  return Response.json({ versions });
}

