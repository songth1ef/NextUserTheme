import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getUserThemeCss, deleteUserThemeVersion, renameUserThemeVersion } from "@/lib/server/theme-store";

const normalizeSegment = (input: string): string => {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
};

export async function GET(request: Request, context: { params: { version: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const version = context.params.version;
  const expectedPrefix = `${normalizeSegment(userId)}-`;
  if (!version.startsWith(expectedPrefix)) return new Response("Forbidden", { status: 403 });
  const css = await getUserThemeCss(userId, version);
  if (!css) return new Response("Not Found", { status: 404 });
  return new Response(css, { status: 200, headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: { version: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const version = context.params.version;
  const expectedPrefix = `${normalizeSegment(userId)}-`;
  if (!version.startsWith(expectedPrefix)) return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  const deleted = await deleteUserThemeVersion(userId, version);
  if (!deleted) return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  return Response.json({ success: true });
}

export async function PUT(request: Request, context: { params: { version: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const version = context.params.version;
  const expectedPrefix = `${normalizeSegment(userId)}-`;
  if (!version.startsWith(expectedPrefix)) return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { versionName?: unknown } | null;
  const versionName = typeof body?.versionName === "string" ? body.versionName.trim() : "";
  if (!versionName) return Response.json({ success: false, message: "versionName 不能为空" }, { status: 400 });
  const renamed = await renameUserThemeVersion(userId, version, versionName);
  if (!renamed) return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  return Response.json({ success: true });
}
