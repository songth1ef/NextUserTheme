import { getUserIdFromRequest } from "@/lib/server/user-session";
import { listLocalePacks, createLocalePack } from "@/lib/server/locale-store";

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const packs = await listLocalePacks(userId);
  return Response.json({ packs });
}

export async function POST(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { name?: unknown; translations?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ success: false, message: "name 不能为空" }, { status: 400 });
  }
  const translations = body?.translations && typeof body.translations === "object" && !Array.isArray(body.translations)
    ? body.translations as Record<string, string>
    : undefined;
  const pack = await createLocalePack({ userId, name, translations });
  return Response.json({ success: true, pack });
}
