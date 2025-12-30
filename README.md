# Next.js 用户自定义 CSS 主题系统

支持用户自定义 CSS 主题，实现 SSR 首屏渲染、客户端热切换、多版本管理和 IndexedDB 缓存。

> **系统定位：** CSS 主题定制系统，专注于样式/主题定制，而非低代码搭建平台。用户可修改已有组件的视觉样式，但不能创建新组件或修改页面结构。

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm start
```

## 核心功能

### 1. CSS 提交与校验

**Function:** `validateUserCss(cssText: string): ValidationResult`

- 使用 PostCSS AST 解析和校验
- 禁止全局选择器、危险属性、外部资源
- 仅允许 `:root` 变量覆盖和 `.user-theme` 作用域

**API:** `POST /api/user-theme`

```typescript
// 提交用户 CSS
const response = await fetch('/api/user-theme', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    css: ':root { --color-primary: #ff4d4f; }',
    source: 'ai'
  })
})
```

### 2. SSR 首屏渲染

**Module:** `app/layout.tsx`

- 服务端获取用户 CSS
- 校验后内联注入 `<style>` 标签
- 避免 FOUC（无样式闪烁）

**Function:** `getCurrentUserTheme(userId: string)`

```typescript
// SSR 中获取用户主题
const theme = await getCurrentUserTheme(userId)
if (theme?.css) {
  // 内联注入到 HTML head
}
```

### 3. 客户端热切换

**Component:** `ThemeProvider`

- IndexedDB 缓存管理
- 多版本支持
- 热切换（无需刷新）

**Function:** `switchTheme(version: string)`

```typescript
const theme = useTheme()
await theme.switchTheme('version-123')
```

### 4. IndexedDB 缓存

**Module:** `lib/css-cache.ts`

**Functions:**
- `getCss(version: string): Promise<UserCssRecord | null>`
- `setCss(record: UserCssRecord): Promise<void>`
- `getAllVersions(): Promise<string[]>`

```typescript
import { cssCache } from '@/lib/css-cache'

// 存储 CSS
await cssCache.setCss({
  version: 'v1',
  css: '...',
  hash: 'sha256...',
  createdAt: Date.now()
})

// 获取 CSS
const cached = await cssCache.getCss('v1')
```

## 项目结构

```
NextUserTheme/
├── app/
│   ├── layout.tsx              # SSR CSS 注入
│   ├── page.tsx                # 主页面
│   └── api/
│       └── user-theme/         # 主题 API
│           ├── route.ts         # POST: 提交主题
│           ├── [version]/route.ts  # GET: 获取主题
│           ├── validate/route.ts    # POST: 校验 CSS
│           └── versions/route.ts   # GET: 版本列表
├── components/
│   ├── ThemeProvider.tsx       # 主题 Context
│   ├── ThemeSwitcher.tsx       # 主题切换 UI
│   └── ThemePreview.tsx        # 主题预览组件
├── lib/
│   ├── css-validator.ts        # CSS 校验模块
│   ├── css-cache.ts           # IndexedDB 缓存
│   ├── css-injector.ts        # Style 标签注入
│   ├── css-hash.ts            # Hash 计算
│   └── server/
│       ├── theme-store.ts     # 服务端主题存储
│       └── user-session.ts    # 用户会话
└── public/
    └── official-theme.css     # 官方主题
```

## API 接口

### POST /api/user-theme

提交用户 CSS 主题

**Request:**
```json
{
  "css": ":root { --color-primary: #ff4d4f; }",
  "source": "ai" | "upload"
}
```

**Response:**
```json
{
  "success": true,
  "version": "demo-user-abc123",
  "hash": "sha256...",
  "cssUrl": "/api/user-theme/demo-user-abc123"
}
```

### GET /api/user-theme/[version]

获取指定版本的 CSS

**Response:** `text/css`

### POST /api/user-theme/validate

校验 CSS 安全性

**Request:**
```json
{
  "css": ":root { --color-primary: #ff4d4f; }"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

### GET /api/user-theme/versions

获取所有版本列表

**Response:**
```json
{
  "versions": ["v1", "v2", "v3"]
}
```

## 核心模块

### CSS 校验模块

**File:** `lib/css-validator.ts`

**Function:** `validateUserCss(cssText: string): ValidationResult`

```typescript
import { validateUserCss } from '@/lib/css-validator'

const result = validateUserCss(css)
if (!result.valid) {
  console.error(result.errors)
}
```

**校验规则:**
- ✅ 允许: `:root { --var: value; }`
- ✅ 允许: `.user-theme .class { ... }`
- ❌ 禁止: `body`, `html`, `*` 选择器
- ❌ 禁止: `position: fixed`, `z-index > 1000`
- ❌ 禁止: `@import`, `@font-face`, `url()`

### 缓存模块

**File:** `lib/css-cache.ts`

**Functions:**
- `getCss(version): Promise<UserCssRecord | null>`
- `setCss(record): Promise<void>`
- `getAllVersions(): Promise<string[]>`
- `getCurrentVersion(): Promise<string | null>`
- `setCurrentVersion(version): Promise<void>`

### 注入模块

**File:** `lib/css-injector.ts`

**Functions:**
- `injectStyle(id, css): void`
- `removeStyle(id): void`
- `getStyleElement(id): HTMLStyleElement | null`
- `removeAllUserThemeStyles(): void`

## 使用示例

### 1. 在组件中使用主题

```tsx
'use client'

import { useTheme } from '@/components/ThemeProvider'

export function MyComponent() {
  const theme = useTheme()
  
  return (
    <div>
      <p>当前主题: {theme.currentVersion || '官方主题'}</p>
      <button onClick={() => theme.switchTheme('v1')}>
        切换到 v1
      </button>
      <button onClick={() => theme.revertToOfficial()}>
        回退官方
      </button>
    </div>
  )
}
```

### 2. 提交自定义主题

```typescript
async function submitTheme(css: string) {
  const res = await fetch('/api/user-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ css, source: 'ai' })
  })
  
  const data = await res.json()
  if (data.success) {
    console.log('主题已提交:', data.version)
    // 自动应用新主题
  }
}
```

### 3. 服务端获取用户主题

```typescript
// app/layout.tsx (Server Component)
import { getCurrentUserTheme } from '@/lib/server/theme-store'

export default async function RootLayout({ children }) {
  const userId = cookies().get('userId')?.value ?? 'demo-user'
  const theme = await getCurrentUserTheme(userId)
  
  return (
    <html>
      <head>
        <link rel="stylesheet" href="/official-theme.css" />
        {theme?.css && (
          <style id={`user-theme-${theme.record.version}`}>
            {theme.css}
          </style>
        )}
      </head>
      <body className={theme?.css ? 'user-theme' : ''}>
        {children}
      </body>
    </html>
  )
}
```

## 技术栈

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.0+
- **CSS Parser:** PostCSS 8.5+
- **Cache:** IndexedDB (via idb)
- **Hash:** crypto-js (SHA-256)

## 环境变量

```env
# .env.local
THEME_FETCH_TIMEOUT=3000  # CSS fetch 超时（毫秒）
```

## 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建
npm run build
```

## 特性

- ✅ SSR 首屏渲染（无 FOUC）
- ✅ 客户端热切换（IndexedDB 缓存）
- ✅ 多版本管理
- ✅ CSS 安全校验（PostCSS AST）
- ✅ 版本回退
- ✅ 离线支持

## 限制

- 仅允许 `:root` 和 `.user-theme` 作用域选择器
- 禁止全局选择器、危险属性、外部资源
- 需要现代浏览器支持（IndexedDB）

## 许可证

MIT
