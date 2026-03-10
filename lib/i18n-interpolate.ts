export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = params[key];
    return v !== undefined ? String(v) : match;
  });
}
