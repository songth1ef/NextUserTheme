import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getLocaleManifest, setActiveLocalePack, getResolvedTranslations } from "@/lib/server/locale-store";

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const manifest = await getLocaleManifest(userId);
  const resolved = await getResolvedTranslations(userId);
  return Response.json({
    activePackId: manifest.activePackId,
    packName: resolved.packName,
    translations: resolved.translations,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { packId?: unknown } | null;
  const packId = body?.packId === null ? null : typeof body?.packId === "string" ? body.packId : undefined;
  if (packId === undefined) {
    return Response.json({ success: false, message: "packId 必须是字符串或 null" }, { status: 400 });
  }
  const ok = await setActiveLocalePack(userId, packId);
  if (!ok) {
    return Response.json({ success: false, message: "语言包不存在" }, { status: 404 });
  }
  const resolved = await getResolvedTranslations(userId);
  return Response.json({
    success: true,
    activePackId: packId,
    packName: resolved.packName,
    translations: resolved.translations,
  });
}
