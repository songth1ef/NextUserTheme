import { validateUserCss } from "@/lib/css-validator";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { css?: unknown } | null;
  const css = typeof body?.css === "string" ? body.css : "";
  const result = validateUserCss(css);
  return Response.json(result, { status: result.valid ? 200 : 400 });
}

