import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getColorMode, setColorMode } from "@/lib/server/theme-store";
import type { ColorMode } from "@/lib/types";

const validModes: readonly ColorMode[] = ["light", "dark", "system"];

export async function GET(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const mode = await getColorMode(userId);
  return Response.json({ mode });
}

export async function PUT(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = typeof body?.mode === "string" ? body.mode : undefined;

  if (!mode || !validModes.includes(mode as ColorMode)) {
    return Response.json({ success: false, message: "mode 必须是 \"light\" | \"dark\" | \"system\"" }, { status: 400 });
  }

  await setColorMode(userId, mode as ColorMode);
  return Response.json({ success: true, mode });
}
