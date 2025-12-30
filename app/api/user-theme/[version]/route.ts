import { getUserIdFromRequest } from "@/lib/server/user-session";
import { getUserThemeCss } from "@/lib/server/theme-store";

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

