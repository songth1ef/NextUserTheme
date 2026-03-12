import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getLocalePack, updateLocalePack, deleteLocalePack } from "@/lib/server/locale-store";
import { sanitizeSegment } from "@/lib/server/sanitize";

export async function GET(request: Request, context: { params: { packId: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const packId = context.params.packId;
  const expectedPrefix = `${sanitizeSegment(userId)}-`;
  if (!packId.startsWith(expectedPrefix)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const pack = await getLocalePack(userId, packId);
  if (!pack) {
    return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  }
  return Response.json({ pack });
}

export async function PUT(request: Request, context: { params: { packId: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const packId = context.params.packId;
  const expectedPrefix = `${sanitizeSegment(userId)}-`;
  if (!packId.startsWith(expectedPrefix)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; translations?: unknown } | null;
  const updates: { name?: string; translations?: Record<string, string> } = {};
  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body?.translations && typeof body.translations === "object" && !Array.isArray(body.translations)) {
    // 逐值校验，过滤掉非 string 条目，防止存储非字符串数据
    const validated: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.translations as Record<string, unknown>)) {
      if (typeof v === "string") validated[k] = v;
    }
    updates.translations = validated;
  }
  if (!updates.name && !updates.translations) {
    return Response.json({ success: false, message: "无更新内容" }, { status: 400 });
  }
  const updated = await updateLocalePack(userId, packId, updates);
  if (!updated) {
    return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  }
  return Response.json({ success: true, pack: updated });
}

export async function DELETE(request: Request, context: { params: { packId: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const packId = context.params.packId;
  const expectedPrefix = `${sanitizeSegment(userId)}-`;
  if (!packId.startsWith(expectedPrefix)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const deleted = await deleteLocalePack(userId, packId);
  if (!deleted) {
    return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
