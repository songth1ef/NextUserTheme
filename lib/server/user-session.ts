const parseCookieValue = (cookieHeader: string, name: string): string | null => {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    const raw = part.slice(name.length + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
};

const normalizeUserId = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "demo-user";
  return trimmed;
};

export function getUserIdFromRequest(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const fromCookie = parseCookieValue(cookieHeader, "userId");
  if (fromCookie) return normalizeUserId(fromCookie);
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return normalizeUserId(match[1]);
  return "demo-user";
}

