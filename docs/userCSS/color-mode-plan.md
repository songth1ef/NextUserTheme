 # 亮色/暗色模式支持方案

## 1. 需求概述

每个主题（官方预设主题 + 用户自定义主题）均可独立切换亮色或暗色模式。

**核心设计：将"主题"和"色彩模式"解耦为两个独立维度。**

```
主题 (Theme)    = 哪套配色方案（官方 / 用户自定义 / 预设）
色彩模式 (Mode) = light | dark | system（跟随系统）
```

---

## 2. 现状分析

| 层面 | 当前状态 |
|------|---------|
| 官方主题 `official-theme.css` | 硬编码 dark，`:root` 下全是暗色变量，`color-scheme: dark` |
| 用户主题 | 仅覆盖 CSS 变量，无亮/暗概念 |
| 预设主题（ThemeSwitcher 内置） | 4 个预设（green/purple/orange/red），全是暗色 |
| 数据模型 | `UserCssRecord` / `VersionInfo` / `UserThemeManifest` 无 `colorMode` 字段 |
| CSS 校验器 | 禁止 `@media`，禁止 `html` / `body` 选择器 |
| SSR | `<html>` 无 `data-color-mode` 属性 |

---

## 3. 技术方案

### 3.1 模式切换机制

通过 `<html data-color-mode="light|dark">` 属性控制，CSS 变量按模式分层定义。

```html
<!-- 暗色模式 -->
<html lang="zh-CN" data-color-mode="dark">

<!-- 亮色模式 -->
<html lang="zh-CN" data-color-mode="light">
```

### 3.2 官方主题 CSS 重构（`public/official-theme.css`）

拆分为亮/暗两套变量，共享变量保留在 `:root` 中：

```css
/* 共享变量（不随模式变化） */
:root {
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --spacing: 12px;
}

/* 暗色模式（默认） */
html[data-color-mode="dark"] {
  --color-bg: #0b1020;
  --color-surface: #111a33;
  --color-surface-hover: #162040;
  --color-text: #e9ecff;
  --color-muted: rgba(233, 236, 255, 0.55);
  --color-primary: #6aa8ff;
  --color-primary-hover: #5a9aef;
  --color-border: rgba(233, 236, 255, 0.10);
  --color-success: #34d399;
  --color-danger: #f87171;
  color-scheme: dark;
}

/* 亮色模式 */
html[data-color-mode="light"] {
  --color-bg: #f8f9fc;
  --color-surface: #ffffff;
  --color-surface-hover: #f0f1f5;
  --color-text: #1a1a2e;
  --color-muted: rgba(26, 26, 46, 0.55);
  --color-primary: #4a8af4;
  --color-primary-hover: #3a7ae4;
  --color-border: rgba(26, 26, 46, 0.12);
  --color-success: #059669;
  --color-danger: #dc2626;
  color-scheme: light;
}
```

组件样式中的硬编码颜色值（如 `rgba(255,255,255,0.08)`）需替换为 CSS 变量或按模式切分：

```css
/* 需要新增的辅助变量 */
html[data-color-mode="dark"] {
  --color-overlay-subtle: rgba(255, 255, 255, 0.04);
  --color-overlay-hover: rgba(255, 255, 255, 0.08);
  --color-overlay-active: rgba(255, 255, 255, 0.12);
  --color-shadow: rgba(0, 0, 0, 0.2);
}

html[data-color-mode="light"] {
  --color-overlay-subtle: rgba(0, 0, 0, 0.02);
  --color-overlay-hover: rgba(0, 0, 0, 0.05);
  --color-overlay-active: rgba(0, 0, 0, 0.08);
  --color-shadow: rgba(0, 0, 0, 0.08);
}
```

### 3.3 CSS 校验器改动（`lib/css-validator.ts`）

#### 新增允许的选择器

```typescript
// isAllowedSelector 函数新增匹配规则
const isAllowedSelector = (rawSelector: string): boolean => {
  const selector = rawSelector.trim();
  if (selector.length === 0) return false;
  if (/^:root\s*$/i.test(selector)) return true;
  if (/^\.user-theme(\s|$)/i.test(selector)) return true;

  // 新增：允许 html[data-color-mode] 属性选择器
  if (/^html\[data-color-mode=["'](light|dark)["']\]\s*$/i.test(selector)) return true;
  if (/^:root\[data-color-mode=["'](light|dark)["']\]\s*$/i.test(selector)) return true;

  return false;
};
```

#### 注意：不放开 `@media`

`system` 模式由 JS 检测 `prefers-color-scheme` 并设置 `data-color-mode` 属性，无需用户 CSS 使用 `@media`。

### 3.4 色彩模式持久化

#### 数据模型（`lib/types.ts`）

```typescript
export type ColorMode = "light" | "dark" | "system";
```

#### 服务端存储（`lib/server/theme-store.ts`）

`manifest.json` 新增 `colorMode` 字段：

```json
{
  "currentVersion": "demo-user-abcd1234",
  "colorMode": "dark",
  "versions": [...]
}
```

新增函数：

```typescript
export async function getColorMode(userId: string): Promise<ColorMode>;
export async function setColorMode(userId: string, mode: ColorMode): Promise<void>;
```

#### API（`app/api/color-mode/route.ts`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/color-mode` | 获取当前色彩模式 |
| PUT | `/api/color-mode` | 设置色彩模式 `{ mode: "light" | "dark" | "system" }` |

### 3.5 SSR 支持（`app/layout.tsx`）

```tsx
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const userId = cookies().get("userId")?.value ?? "demo-user";

  // 读取 colorMode
  const colorMode = await getColorMode(userId); // "light" | "dark" | "system"
  const resolvedMode = colorMode === "system" ? "dark" : colorMode; // SSR 默认 dark

  return (
    <html lang="zh-CN" data-color-mode={resolvedMode}>
      <head>
        {/* system 模式：注入阻塞脚本检测系统偏好，防止闪烁 */}
        {colorMode === "system" && (
          <script dangerouslySetInnerHTML={{ __html:
            `(function(){` +
            `var m=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';` +
            `document.documentElement.setAttribute('data-color-mode',m);` +
            `})()`
          }} />
        )}
        <link id="official-theme" rel="stylesheet" href="/official-theme.css" />
        {userCss && userVersion ? (
          <style id={`user-theme-${userVersion}`}>{userCss}</style>
        ) : null}
      </head>
      <body className={userCss ? "user-theme" : undefined}>
        <ColorModeProvider initialMode={colorMode}>
          <I18nProvider ...>
            <ThemeProvider ...>{children}</ThemeProvider>
          </I18nProvider>
        </ColorModeProvider>
      </body>
    </html>
  );
}
```

### 3.6 客户端 ColorMode Context（`components/ColorModeProvider.tsx`）

```typescript
interface ColorModeContextValue {
  readonly colorMode: ColorMode;        // 用户选择："light" | "dark" | "system"
  readonly resolvedMode: "light" | "dark";  // 实际生效的模式
  readonly setColorMode: (mode: ColorMode) => Promise<void>;
}
```

核心逻辑：

1. 监听 `matchMedia('(prefers-color-scheme: dark)')` 变化事件
2. 切换时更新 `document.documentElement.dataset.colorMode`
3. 调用 `PUT /api/color-mode` 同步到服务端

```typescript
export function ColorModeProvider({ children, initialMode }: Props) {
  const [colorMode, setColorModeState] = useState<ColorMode>(initialMode);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
    if (initialMode !== "system") return initialMode;
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // 监听系统偏好变化
  useEffect(() => {
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const mode = e.matches ? "dark" : "light";
      setResolvedMode(mode);
      document.documentElement.setAttribute("data-color-mode", mode);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorMode]);

  // 切换模式
  const setColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    setResolvedMode(resolved);
    document.documentElement.setAttribute("data-color-mode", resolved);

    // 同步到服务端
    await fetch("/api/color-mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  }, []);

  // ...
}
```

### 3.7 UI 改动（`components/ThemeSwitcher.tsx`）

状态栏区域新增模式切换按钮组：

```tsx
<div className="status-bar">
  {/* 现有状态内容... */}

  {/* 新增：色彩模式切换 */}
  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
    <button
      className={`btn btn-sm ${resolvedMode === "light" ? "btn-primary" : ""}`}
      onClick={() => void setColorMode("light")}
    >
      {t("colorMode.light")}
    </button>
    <button
      className={`btn btn-sm ${resolvedMode === "dark" ? "btn-primary" : ""}`}
      onClick={() => void setColorMode("dark")}
    >
      {t("colorMode.dark")}
    </button>
    <button
      className={`btn btn-sm ${colorMode === "system" ? "btn-primary" : ""}`}
      onClick={() => void setColorMode("system")}
    >
      {t("colorMode.system")}
    </button>
  </div>
</div>
```

### 3.8 预设主题更新

每个预设 CSS 需包含亮/暗两套变量：

```css
/* 绿色主题 - 暗色 */
html[data-color-mode="dark"] {
  --color-primary: #10b981;
  --color-surface: #064e3b;
  --color-border: rgba(16, 185, 129, 0.3);
}

/* 绿色主题 - 亮色 */
html[data-color-mode="light"] {
  --color-primary: #059669;
  --color-surface: #ecfdf5;
  --color-border: rgba(5, 150, 105, 0.2);
}

/* 组件覆盖（两种模式共用） */
.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
}

.user-theme a {
  color: var(--color-primary);
}
```

### 3.9 i18n 翻译键

新增翻译键：

```typescript
// locales/keys.ts 新增
"colorMode.title": "色彩模式",
"colorMode.light": "亮色",
"colorMode.dark": "暗色",
"colorMode.system": "跟随系统",
```

```json
// public/locales/en.json 新增
{
  "colorMode.title": "Color Mode",
  "colorMode.light": "Light",
  "colorMode.dark": "Dark",
  "colorMode.system": "System"
}
```

---

## 4. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `public/official-theme.css` | **重写** | 拆分亮/暗变量 + 组件样式硬编码颜色改为变量 |
| `lib/css-validator.ts` | **修改** | `isAllowedSelector` 新增 `html[data-color-mode=...]` 匹配 |
| `lib/types.ts` | **修改** | 新增 `ColorMode` 类型导出 |
| `lib/server/theme-store.ts` | **修改** | manifest 增加 `colorMode` 字段，新增 `getColorMode` / `setColorMode` |
| `app/api/color-mode/route.ts` | **新增** | GET / PUT 色彩模式 API |
| `app/layout.tsx` | **修改** | SSR 读取 colorMode，`<html>` 输出 `data-color-mode`，system 模式防闪烁脚本 |
| `components/ColorModeProvider.tsx` | **新增** | 色彩模式 React Context + Provider |
| `components/ThemeSwitcher.tsx` | **修改** | 状态栏添加亮色/暗色/跟随系统切换按钮 |
| `locales/zh-CN.json` | **修改** | 新增 `colorMode.*` 翻译键 |
| `public/locales/en.json` | **修改** | 新增 `colorMode.*` 翻译键 |
| `locales/keys.ts` | **修改** | 新增 `colorMode.*` 键定义 |

---

## 5. 用户 CSS 编写指南（更新）

### 5.1 基础用法（两种模式共用）

与现有方式相同，仅覆盖 `:root` 变量，两种模式下均生效：

```css
:root {
  --color-primary: #ff4d4f;
}
```

### 5.2 按模式分别覆盖

```css
/* 暗色模式下的主题色 */
html[data-color-mode="dark"] {
  --color-primary: #ff6b6b;
  --color-surface: #2d1b1b;
}

/* 亮色模式下的主题色 */
html[data-color-mode="light"] {
  --color-primary: #dc2626;
  --color-surface: #fef2f2;
}

/* 组件样式（两种模式共用） */
.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
}
```

### 5.3 允许的选择器汇总

| 选择器 | 说明 |
|--------|------|
| `:root` | 覆盖 CSS 变量（全模式生效） |
| `html[data-color-mode="dark"]` | 暗色模式变量覆盖 |
| `html[data-color-mode="light"]` | 亮色模式变量覆盖 |
| `:root[data-color-mode="dark"]` | 同上（替代写法） |
| `:root[data-color-mode="light"]` | 同上（替代写法） |
| `.user-theme ...` | 组件样式覆盖 |

---

## 6. 向后兼容性

| 场景 | 表现 |
|------|------|
| 已有用户主题（仅 `:root` 覆盖） | 暗色模式下表现不变 |
| `colorMode` 默认值 | `"dark"`，现有用户体验无影响 |
| 用户未设置 colorMode | manifest 无此字段时 fallback 为 `"dark"` |
| 旧 manifest.json 无 colorMode | 读取时兼容处理，返回默认 `"dark"` |
| 用户主题只写了暗色变量 | 亮色模式下 fallback 到官方亮色变量，用户覆盖的部分可能需要适配 |

---

## 7. 实施顺序

```
Step 1: 基础设施
  ├─ lib/types.ts          新增 ColorMode 类型
  ├─ lib/css-validator.ts  放开 html[data-color-mode] 选择器
  └─ lib/server/theme-store.ts  manifest 增加 colorMode 读写

Step 2: 官方主题重构
  └─ public/official-theme.css  拆分亮/暗变量 + 硬编码颜色改变量

Step 3: 服务端集成
  ├─ app/api/color-mode/route.ts  新增 API
  └─ app/layout.tsx              SSR data-color-mode + 防闪烁脚本

Step 4: 客户端集成
  ├─ components/ColorModeProvider.tsx  新增 Context
  └─ components/ThemeSwitcher.tsx      添加切换 UI

Step 5: 预设主题 & i18n
  ├─ components/ThemeSwitcher.tsx  预设 CSS 增加亮色变量
  ├─ locales/zh-CN.json           新增翻译键
  ├─ public/locales/en.json       新增翻译键
  └─ locales/keys.ts              新增键定义
```
