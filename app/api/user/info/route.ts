import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getUserThemeInfo } from "@/lib/server/theme-store";

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const info = await getUserThemeInfo(userId);
  return Response.json(info);
}

