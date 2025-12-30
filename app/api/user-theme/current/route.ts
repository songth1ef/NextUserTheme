import { getUserIdFromRequest } from "@/lib/server/user-session";
import { setCurrentUserThemeVersion } from "@/lib/server/theme-store";

export async function PUT(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { version?: unknown } | null;
  const version = typeof body?.version === "string" ? body.version : body?.version === null ? null : undefined;
  
  if (version === undefined) {
    return Response.json({ success: false, message: "version 必须是 string 或 null" }, { status: 400 });
  }
  
  const success = await setCurrentUserThemeVersion(userId, version);
  if (!success) {
    return Response.json({ success: false, message: "版本不存在或设置失败" }, { status: 404 });
  }
  
  return Response.json({ success: true, version });
}

