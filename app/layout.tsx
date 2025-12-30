import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { validateUserCss } from "@/lib/css-validator";
import { getCurrentUserTheme } from "@/lib/server/theme-store";
import { ThemeProvider } from "@/components/ThemeProvider";

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const userId = cookies().get("userId")?.value ?? "demo-user";
  const timeoutMsRaw = process.env.THEME_FETCH_TIMEOUT;
  const timeoutMs = timeoutMsRaw ? Number.parseInt(timeoutMsRaw, 10) : 3000;
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;
  const theme = await Promise.race([
    getCurrentUserTheme(userId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), safeTimeoutMs))
  ]);
  let userCss: string | null = null;
  let userVersion: string | null = null;
  if (theme?.css && theme.record?.version) {
    const validation = validateUserCss(theme.css);
    if (validation.valid) {
      userCss = theme.css.replace(/<\/style/gi, "<\\/style");
      userVersion = theme.record.version;
    } else {
      console.error("CSS validation failed (SSR):", validation.errors);
    }
  }
  return (
    <html lang="zh-CN">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link id="official-theme" rel="stylesheet" href="/official-theme.css" />
        {userCss && userVersion ? (
          <style id={`user-theme-${userVersion}`}>{userCss}</style>
        ) : null}
      </head>
      <body className={userCss ? "user-theme" : undefined}>
        <ThemeProvider initialVersion={userVersion}>{children}</ThemeProvider>
      </body>
    </html>
  );
}

