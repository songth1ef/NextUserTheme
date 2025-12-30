import { validateUserCss } from "@/lib/css-validator";
import { getUserIdFromRequest } from "@/lib/server/user-session";
import { saveUserTheme } from "@/lib/server/theme-store";

const maxCssBytes = 200 * 1024;

export async function POST(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { css?: unknown; source?: unknown } | null;
  const css = typeof body?.css === "string" ? body.css : "";
  const source = body?.source === "upload" || body?.source === "ai" ? body.source : null;
  if (!source) return Response.json({ success: false, errors: [{ type: "other", message: "source 必须是 upload 或 ai" }] }, { status: 400 });
  const cssBytes = new TextEncoder().encode(css).byteLength;
  if (cssBytes > maxCssBytes) return Response.json({ success: false, errors: [{ type: "other", message: `CSS 过大（> ${maxCssBytes} bytes）` }] }, { status: 413 });
  const validation = validateUserCss(css);
  if (!validation.valid) return Response.json({ success: false, errors: validation.errors }, { status: 400 });
  const saved = await saveUserTheme({ userId, css });
  return Response.json({
    success: true,
    version: saved.version,
    hash: saved.hash,
    cssUrl: `/api/user-theme/${encodeURIComponent(saved.version)}`
  });
}

