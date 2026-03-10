import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getLocalePack, updateLocalePack, deleteLocalePack } from "@/lib/server/locale-store";

const normalizeSegment = (input: string): string => {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
};

export async function GET(request: Request, context: { params: { packId: string } }): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const packId = context.params.packId;
  const expectedPrefix = `${normalizeSegment(userId)}-`;
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
  const expectedPrefix = `${normalizeSegment(userId)}-`;
  if (!packId.startsWith(expectedPrefix)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; translations?: unknown } | null;
  const updates: { name?: string; translations?: Record<string, string> } = {};
  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body?.translations && typeof body.translations === "object" && !Array.isArray(body.translations)) {
    updates.translations = body.translations as Record<string, string>;
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
  const expectedPrefix = `${normalizeSegment(userId)}-`;
  if (!packId.startsWith(expectedPrefix)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const deleted = await deleteLocalePack(userId, packId);
  if (!deleted) {
    return Response.json({ success: false, message: "Not Found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
