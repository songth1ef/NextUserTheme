# 无白屏/布局抖动的 Next.js 主题系统架构

> 针对本项目（NextUserTheme）快速刷新时出现白屏和首屏布局抖动问题的根因分析，以及从零开始实现同功能、无闪烁效果的技术方案。

## 目录

1. [根本原因分析](#根本原因分析)
2. [正确架构总览](#正确架构总览)
3. [关键技术点](#关键技术点)
4. [架构对比总结](#架构对比总结)

---

## 根本原因分析

### 根因 1：`<link rel="stylesheet">` 异步加载官方 CSS

```html
<!-- 当前项目 layout.tsx:65 -->
<link id="official-theme" rel="stylesheet" href="/official-theme.css" />
```

HTML 已经渲染（内联 CSS 生效）→ 网络请求 → CSS 到达 → 浏览器重新布局。
这是最直接的 FOUC（Flash of Unstyled Content）来源。

---

### 根因 2：ThemeProvider 的 `useEffect` 在每次挂载时调用 `refreshTheme()`

```ts
// ThemeProvider.tsx:158-160
useEffect(() => {
  void refreshTheme();  // 每次挂载都执行
}, [refreshTheme]);
```

调用链：`refreshTheme()` → 请求 `/api/user/info` → `applyVersion({preferSsr: true, silent: ssrHashOk})`

即使 `silent: true`，`done()` 函数仍然会调用：

```ts
// ThemeProvider.tsx:77
injectStyle(styleId, css);  // existing.textContent = css → 触发浏览器 repaint
```

SSR 已经注入了 `<style id="user-theme-v1">xxx</style>`，然后客户端再 `.textContent = css`，触发一次额外的重绘。

---

### 根因 3：React Strict Mode 导致 Effect 执行两次（开发环境）

`reactStrictMode: true` → `useEffect` 执行 2 次 → `refreshTheme()` 调用 2 次
→ 样式被注入 / 移除 / 再注入，在开发环境造成明显闪烁。

---

### 根因 4：`ColorModeProvider` 的 `useState` 初始值服务端/客户端不一致

```ts
// ColorModeProvider.tsx:25-29
const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
  if (initialMode !== "system") return initialMode;
  if (typeof window === "undefined") return "dark";   // SSR: 永远 "dark"
  return window.matchMedia("...").matches ? "dark" : "light"; // 客户端: 可能 "light"
});
```

服务端渲染 `"dark"` → 客户端 hydration 得到 `"light"` → React 18 触发 re-render → 颜色闪烁。

---

### 根因 5：`<html>` 上缺少 `suppressHydrationWarning`

系统颜色模式的内联脚本会在 hydration 之前修改 `data-color-mode` 属性：

```js
// layout.tsx:60-63（内联脚本）
(function(){
  var m = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-color-mode', m)
})()
```

但 `<html lang="zh-CN" data-color-mode={resolvedMode}>` 没有 `suppressHydrationWarning`，
React 发现属性值不匹配时会尝试纠正，产生闪烁。

---

## 正确架构总览

### 核心原则

```
首次绘制所需的一切  →  必须来自 SSR，内联在 <head> 中
客户端 hydration 后  →  不产生任何可见的视觉变化
```

### 渲染临界路径

```
1. 浏览器接收 HTML
2. 解析 <head>
   ├── <style> 内联 CSS 变量（dark/light 两套）      ← 立即生效，无网络请求
   ├── <script> 系统颜色检测（同步，阻塞但极小）      ← body 渲染前修正颜色
   ├── <style> 官方基础样式（内联，非外部 link）       ← 无网络请求
   └── <style id="uth-v1"> 用户自定义 CSS（SSR注入） ← 已在 DOM 中
3. 渲染 <body>
   ├── 颜色已正确（data-color-mode 属性正确）
   ├── 布局已正确（官方样式已内联）
   └── 用户主题已生效（用户 CSS 已内联）
4. React hydration
   └── 不产生任何视觉变化（无需重注入任何样式）
```

### 文件结构

```
app/
  layout.tsx               ← Server Component，SSR 所有用户数据
  page.tsx

lib/
  server/
    theme-store.ts         ← 服务端：读写用户主题（文件系统/数据库）
    locale-store.ts        ← 服务端：读写用户语言包
  css-hash.ts              ← SHA-256 哈希（服务端/客户端共享）
  css-injector.ts          ← 客户端：DOM style 注入

components/
  ThemeProvider.tsx        ← "use client"
  ColorModeProvider.tsx    ← "use client"
  I18nProvider.tsx         ← "use client"
```

---

## 关键技术点

### 技术点 1：layout.tsx — 内联所有关键 CSS，消除外部链接

```tsx
// app/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getCurrentUserTheme, getColorMode } from "@/lib/server/theme-store";
import { getTranslations } from "@/lib/server/locale-store";
import { validateUserCss } from "@/lib/css-validator";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ColorModeProvider } from "@/components/ColorModeProvider";
import { I18nProvider } from "@/components/I18nProvider";

// ★ 关键：将官方主题 CSS 内联，而非 <link> 外部加载
// 可以在构建时读取文件，或直接写在这里
const OFFICIAL_CSS = `
  /* 你的官方基础样式 */
  :root { --radius: 12px; }
`;

// ★ 关键：两种颜色模式的 CSS 变量必须同时内联
// 通过属性选择器切换，无需 JS 介入
const COLOR_VARS_CSS = `
  html[data-color-mode="dark"]  {
    --bg: #0b1020; --text: #e9ecff;
    color-scheme: dark; background: #0b1020; color: #e9ecff
  }
  html[data-color-mode="light"] {
    --bg: #f8f9fc; --text: #1a1a2e;
    color-scheme: light; background: #f8f9fc; color: #1a1a2e
  }
  html, body { margin: 0; padding: 0; font-family: system-ui, sans-serif }
  *, *::before, *::after { box-sizing: border-box }
`;

// ★ 关键：system 模式的颜色检测脚本——必须在 body 渲染前执行
// 这是一段同步脚本，浏览器解析到它时立即执行，此时页面还未绘制
// 体积必须极小（几十字节），因为它阻塞渲染
const SYSTEM_COLOR_SCRIPT = `(function(){try{var m=localStorage.getItem('colorMode');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-color-mode',m)}else{var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-color-mode',dark?'dark':'light')}}catch(e){}})()`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const userId = cookies().get("userId")?.value ?? "guest";

  const [theme, colorMode, i18n] = await Promise.all([
    getCurrentUserTheme(userId).catch(() => null),
    getColorMode(userId).catch(() => "dark" as const),
    getTranslations(userId).catch(() => ({ packId: null, translations: {} })),
  ]);

  let userCss: string | null = null;
  let userVersion: string | null = null;
  if (theme?.css && theme.version) {
    const validation = validateUserCss(theme.css);
    if (validation.valid) {
      // ★ 关键：转义 </style> 防止 XSS 注入
      userCss = theme.css.replace(/<\/style/gi, "<\\/style");
      userVersion = theme.version;
    }
  }

  // 服务端已知的颜色模式（用于 SSR HTML 属性）
  // system 模式：SSR 先输出一个默认值，脚本执行后立即修正（在首次绘制前）
  const ssrColorMode = colorMode === "system" ? "dark" : colorMode;

  return (
    // ★ 关键：suppressHydrationWarning 防止 React hydration 覆盖脚本修改的属性
    // 没有它，React 会把脚本改过的 data-color-mode 改回 SSR 值，产生颜色闪烁
    <html lang="zh-CN" data-color-mode={ssrColorMode} suppressHydrationWarning>
      <head>
        {/* 1. 颜色变量 + 基础重置 CSS — 最先内联，防止无样式内容闪烁 */}
        <style dangerouslySetInnerHTML={{ __html: COLOR_VARS_CSS }} />

        {/*
          2. system 模式检测脚本 — 在 body 渲染前修正 data-color-mode
             必须放在 <style> 之后、<body> 之前，且没有 defer/async
             注意：使用 Cookie 方案时此脚本仅在 system 模式下需要
        */}
        {colorMode === "system" && (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_COLOR_SCRIPT }} />
        )}

        {/* 3. 官方基础样式 — 内联而非外部 <link>，避免 FOUC */}
        <style dangerouslySetInnerHTML={{ __html: OFFICIAL_CSS }} />

        {/* 4. 用户自定义 CSS — SSR 直接内联，客户端 hydration 时样式已存在 */}
        {userCss && userVersion && (
          <style id={`uth-${userVersion}`}>{userCss}</style>
        )}
      </head>
      <body className={userCss ? "has-user-theme" : undefined}>
        <ColorModeProvider initialMode={colorMode}>
          <I18nProvider
            initialTranslations={i18n.translations}
            initialPackId={i18n.packId}
          >
            {/*
              ★ 关键：传入 ssrApplied=true 告知客户端 SSR 已注入样式
              ThemeProvider 据此决定是否跳过首次 injectStyle 调用
            */}
            <ThemeProvider
              initialVersion={userVersion}
              ssrApplied={userCss !== null}
            >
              {children}
            </ThemeProvider>
          </I18nProvider>
        </ColorModeProvider>
      </body>
    </html>
  );
}
```

---

### 技术点 2：ThemeProvider — SSR 已注入则跳过重注入

这是消除 hydration 后重绘的核心。

```tsx
// components/ThemeProvider.tsx
"use client";

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState
} from "react";

interface ThemeContextValue {
  currentVersion: string | null;
  isLoading: boolean;
  switchTheme: (version: string) => Promise<void>;
  revertToOfficial: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialVersion,
  ssrApplied,
}: {
  children: React.ReactNode;
  initialVersion: string | null;
  ssrApplied: boolean;  // ← SSR 是否已经内联了样式
}) {
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // ★ 核心逻辑：
    // 如果 SSR 已注入样式 → 只后台同步 IndexedDB，不碰 DOM，不触发 repaint
    // 如果 SSR 未注入样式（如纯客户端导航）→ 主动拉取并注入
    if (ssrApplied && initialVersion) {
      const ssrEl = document.getElementById(`uth-${initialVersion}`) as HTMLStyleElement | null;
      const css = ssrEl?.textContent ?? "";
      if (css) {
        // 后台异步同步到 IndexedDB，不阻塞渲染，不触发任何 state 变更
        syncCssToCache(initialVersion, css).catch(console.error);
        return; // ← 直接返回，不调用 injectStyle()
      }
    }

    // SSR 没有内联（或内联失败），客户端主动拉取
    if (initialVersion) {
      void fetchAndApplyTheme(initialVersion);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ★ 空依赖数组：只在 mount 时执行一次，且是幂等的

  const switchTheme = useCallback(async (version: string) => {
    setIsLoading(true);
    try {
      const css = await fetchCss(version);
      // 先注入新样式，再移除旧样式（避免样式空白期）
      injectStyle(`uth-${version}`, css);
      document.body.classList.add("has-user-theme");
      if (currentVersion && currentVersion !== version) {
        removeStyle(`uth-${currentVersion}`);
      }
      setCurrentVersion(version);
      // 后台并行：持久化到服务端 + IndexedDB
      await Promise.all([
        syncVersionToServer(version),
        syncCssToCache(version, css),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [currentVersion]);

  const revertToOfficial = useCallback(async () => {
    removeAllUserThemeStyles();
    document.body.classList.remove("has-user-theme");
    setCurrentVersion(null);
    await syncVersionToServer(null);
  }, []);

  return (
    <ThemeContext.Provider value={{ currentVersion, isLoading, switchTheme, revertToOfficial }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

**关键差异**：当前项目在 `useEffect` 中调用 `refreshTheme()` → 网络请求 → `injectStyle()` → DOM repaint。
新方案：如果 SSR 已注入，`useEffect` 只做后台 IndexedDB 同步，**不触发任何 DOM 变更**。

---

### 技术点 3：ColorModeProvider — 避免 hydration 不匹配

```tsx
// components/ColorModeProvider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ColorMode = "light" | "dark" | "system";

interface ColorModeContextValue {
  colorMode: ColorMode;
  // ★ 不再把 resolvedMode 存入 useState（会造成 SSR/客户端不一致）
  // 改为提供一个读取函数，直接从 DOM 属性读取真相来源
  getResolvedMode: () => "light" | "dark";
  setColorMode: (mode: ColorMode) => Promise<void>;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  colorMode: "dark",
  getResolvedMode: () => "dark",
  setColorMode: async () => {},
});

export function ColorModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: ColorMode;
}) {
  // ★ 只存储用户的"意图"（light/dark/system），不存储"解析结果"
  // 因为 initialMode 来自服务端 cookie，SSR 和客户端一致，不会造成 hydration 不匹配
  const [colorMode, setColorModeState] = useState<ColorMode>(initialMode);

  useEffect(() => {
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      // 直接修改 DOM 属性，CSS 通过属性选择器自动响应，无需 state 变更
      document.documentElement.setAttribute(
        "data-color-mode",
        e.matches ? "dark" : "light"
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorMode]);

  // ★ 直接从 DOM 读取颜色模式，作为真相来源
  const getResolvedMode = useCallback((): "light" | "dark" => {
    if (typeof document === "undefined") return "dark";
    return (document.documentElement.getAttribute("data-color-mode") ?? "dark") as "light" | "dark";
  }, []);

  const setColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    // 直接修改 DOM 属性，CSS 自动响应
    document.documentElement.setAttribute("data-color-mode", resolved);
    // 同步到服务端（下次 SSR 时读取 cookie 使用）
    await fetch("/api/color-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
      headers: { "Content-Type": "application/json" },
    });
  }, []);

  return (
    <ColorModeContext.Provider value={{ colorMode, getResolvedMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}
```

---

### 技术点 4：颜色模式存储策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Cookie（服务端读取）** | SSR HTML 直接正确，无需客户端脚本修正 | 每次请求都携带 cookie | 有登录态的系统（本项目方案） |
| **localStorage + 内联脚本** | 无服务端依赖 | SSR 总是输出默认值，脚本在首次绘制前修正 | 纯静态站点、无服务端 |
| **两者结合** | 首次访问用脚本，登录后同步 cookie | 逻辑复杂 | 兼顾两种情况 |

本项目使用 Cookie 方案，这是正确的选择。
**注意**：内联脚本必须满足以下条件才能真正无闪烁：
- 放在 `<head>` 内（body 渲染前）
- 同步执行（无 `async`、无 `defer`）
- 体积极小（不超过 200 字节），因为它阻塞渲染

---

### 技术点 5：`suppressHydrationWarning` 的作用机制

React hydration 过程：

```
服务端渲染 HTML  →  <html data-color-mode="dark">
                     ↓
内联脚本执行     →  <html data-color-mode="light">  (系统为浅色模式)
                     ↓
React hydration  →  发现属性不匹配（SSR="dark" vs DOM="light"）
                     ↓
无 suppressHydrationWarning  →  React 改回 "dark"  →  颜色闪烁
有 suppressHydrationWarning  →  React 跳过此属性的比对  →  无闪烁
```

`suppressHydrationWarning` 加在哪个元素上，就跳过该元素**自身**属性的 hydration 检查。
**注意**：它不影响子元素的 hydration 检查。

---

### 技术点 6：官方 CSS 的内联策略

如果官方 CSS 较大（几十 KB），不建议全部内联（增大 HTML 体积，影响 TTFB）。
推荐拆分方案：

```tsx
// 方案 A（推荐）：关键 CSS 内联 + 非关键 CSS 异步加载
// 关键 CSS：影响首屏布局的样式（CSS 变量、基础布局、上方内容的样式）
<style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
// 非关键 CSS：动画、图标、页面底部样式
<link
  rel="stylesheet"
  href="/non-critical.css"
  media="print"
  // @ts-expect-error onLoad 在 link 上有效
  onLoad="this.media='all'"
/>

// 方案 B（简单场景）：全部内联
// 如果 gzip 后 < 10KB，直接内联没有问题，且可简化架构

// 方案 C：构建时处理
// 在 next.config.js 中通过 webpack 将 CSS 文件转为字符串常量
// 实现"写在文件里，内联到 HTML"的效果
```

---

## 架构对比总结

| 维度 | 当前项目（有闪烁） | 正确架构（无闪烁） |
|------|------|------|
| 官方 CSS 加载方式 | `<link>` 外部异步加载 | 内联 `<style>` |
| 用户 CSS | SSR 内联 ✓ | SSR 内联 ✓ |
| 颜色变量 | SSR 内联 ✓ | SSR 内联 ✓ |
| `suppressHydrationWarning` | 缺失 | 加在 `<html>` 上 |
| 首次 mount 是否重注入样式 | 是（即使 silent 也调用 `injectStyle`） | **否，跳过不触发 DOM 变更** |
| `resolvedMode` 存储 | `useState`（SSR/客户端可能不一致） | 从 DOM 属性读取（无 state） |
| Strict Mode 双次 effect | 两次网络请求 + 两次样式注入 | `useEffect` 幂等，多次执行无副作用 |
| 客户端首次渲染后的视觉变化 | 有（样式重注入触发 repaint） | **无** |

### 最核心的一句话

> SSR 已经把正确的样式内联在 HTML 里了，
> 客户端 hydration 后唯一要做的事是**接管控制权**，
> 而不是**重新应用一遍**。
