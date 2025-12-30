const protectedStyleIds: readonly string[] = ["official-theme"];

const isBrowser = (): boolean => {
  return typeof window !== "undefined" && typeof document !== "undefined";
};

export function getStyleElement(id: string): HTMLStyleElement | null {
  if (!isBrowser()) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  if (el.tagName.toLowerCase() !== "style") return null;
  return el as HTMLStyleElement;
}

export function injectStyle(id: string, css: string): void {
  if (!isBrowser()) return;
  const existing = getStyleElement(id);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.setAttribute("data-managed-by", "user-theme");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

export function updateStyle(id: string, css: string): void {
  if (!isBrowser()) return;
  const existing = getStyleElement(id);
  if (!existing) {
    injectStyle(id, css);
    return;
  }
  existing.textContent = css;
}

export function removeStyle(id: string): void {
  if (!isBrowser()) return;
  if (protectedStyleIds.includes(id)) return;
  const existing = getStyleElement(id);
  if (!existing) return;
  existing.remove();
}

export function removeAllUserThemeStyles(): void {
  if (!isBrowser()) return;
  const nodes = Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-managed-by="user-theme"]'));
  for (const node of nodes) {
    if (protectedStyleIds.includes(node.id)) continue;
    node.remove();
  }
  const legacyNodes = Array.from(document.querySelectorAll<HTMLStyleElement>('style[id^="user-theme-"]'));
  for (const node of legacyNodes) {
    if (protectedStyleIds.includes(node.id)) continue;
    node.remove();
  }
}

