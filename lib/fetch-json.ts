export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res: Response = await fetch(url, init);
  const parsed: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message: string | null = (() => {
      if (!parsed || typeof parsed !== "object") return null;
      const maybeMessage: unknown = (parsed as Record<string, unknown>).message;
      return typeof maybeMessage === "string" && maybeMessage.trim().length > 0 ? maybeMessage : null;
    })();
    throw new Error(message ?? `Request failed: ${res.status}`);
  }
  if (parsed === null) throw new Error("Invalid JSON response");
  return parsed as T;
}
