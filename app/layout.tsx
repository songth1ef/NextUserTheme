import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { validateUserCss } from "@/lib/css-validator";
import { getCurrentUserTheme, getColorMode } from "@/lib/server/theme-store";
import { getResolvedTranslations, getBuiltinTranslations } from "@/lib/server/locale-store";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { ColorModeProvider } from "@/components/ColorModeProvider";

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const userId = cookies().get("userId")?.value ?? "demo-user";
  const timeoutMsRaw = process.env.THEME_FETCH_TIMEOUT;
  const timeoutMs = timeoutMsRaw ? Number.parseInt(timeoutMsRaw, 10) : 3000;
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;

  const [theme, i18n, colorMode] = await Promise.all([
    Promise.race([
      getCurrentUserTheme(userId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), safeTimeoutMs))
    ]),
    Promise.race([
      getResolvedTranslations(userId),
      new Promise<{ packId: null; packName: string; translations: Record<string, string> }>((resolve) =>
        setTimeout(() => resolve({ packId: null, packName: "简体中文（预置）", translations: getBuiltinTranslations() }), safeTimeoutMs)
      )
    ]),
    Promise.race([
      getColorMode(userId),
      new Promise<"dark">((resolve) => setTimeout(() => resolve("dark"), safeTimeoutMs))
    ]),
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

  const resolvedMode = colorMode === "system" ? "dark" : colorMode;

  return (
    <html lang="zh-CN" data-color-mode={resolvedMode}>
      <head>
        {colorMode === "system" ? (
          <script dangerouslySetInnerHTML={{ __html:
            `(function(){var m=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-color-mode',m)})()`
          }} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link id="official-theme" rel="stylesheet" href="/official-theme.css" />
        {userCss && userVersion ? (
          <style id={`user-theme-${userVersion}`}>{userCss}</style>
        ) : null}
      </head>
      <body className={userCss ? "user-theme" : undefined}>
        <ColorModeProvider initialMode={colorMode}>
          <I18nProvider initialTranslations={i18n.translations} initialPackId={i18n.packId} initialPackName={i18n.packName}>
            <ThemeProvider initialVersion={userVersion}>{children}</ThemeProvider>
          </I18nProvider>
        </ColorModeProvider>
      </body>
    </html>
  );
}
