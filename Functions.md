# 用户自定义 CSS 主题系统需求文档

## 1. 项目背景

系统前端使用 Next.js 框架

**目标：** 支持用户自定义 CSS（AI 生成或上传文件），覆盖官方主题，实现：

- 安全、可控的主题覆盖
- 首屏 SSR 渲染用户主题
- 客户端热切换、多版本管理、回退
- 高性能、可扩展的缓存策略

## 2. 核心需求

### 2.1 用户提交 CSS

- 支持上传文件或 AI 生成 CSS
- 用户 CSS 通过接口返回 URL 或文本
- 提交前必须校验 CSS 安全性

### 2.2 CSS 校验

使用 PostCSS AST 进行校验

**禁止：**

- 全局选择器（`body`, `html`, `*`）
- 危险属性（`position: fixed`, `z-index > 1000`）
- `@import`、`@font-face` 等

**只允许：**

- `:root` 变量覆盖官方 CSS
- `.user-theme` 作用域 class

### 2.3 缓存策略

- **IndexedDB**（首选）
- 支持多版本历史
- 异步存储，不阻塞 UI

**记录结构：**

```typescript
interface UserCssRecord {
  version: string
  css: string
  hash: string
  createdAt: number
}
```

### 2.4 加载策略

**官方 CSS：**

- SSR + CSR 均加载，固定不变

**用户 CSS：**

- **SSR：** 服务端获取 userInfo → 拉取 CSS → 校验 → 内联 `<style>` 注入
- **CSR：** 客户端 ThemeProvider 负责：
  - IndexedDB 缓存查询
  - fetch + 校验 + 缓存
  - style 标签注入

### 2.5 热切换

**主题切换：**

- 客户端删除旧 `<style>` 标签，注入新用户 CSS
- 官方 CSS 永远不删除
- 支持版本回退

## 3. 架构设计

## 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP Request
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js SSR 服务端                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Server Component / getServerSideProps               │   │
│  │  1. 获取 userInfo (Cookie/Token)                     │   │
│  │  2. fetch 用户 CSS (userCSSUrl)                     │   │
│  │  3. validateUserCss() 校验                          │   │
│  │  4. 内联 <style> 注入 HTML head                      │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTML + Inline CSS
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      客户端 Hydration                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ThemeProvider (Client)                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │ CSS 校验模块  │  │ 缓存模块      │  │ 注入模块   │ │   │
│  │  │ PostCSS AST  │  │ IndexedDB    │  │ Style Tag │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  │                                                     │   │
│  │  功能：                                              │   │
│  │  • 检查 SSR 注入的 CSS，提取并缓存到 IndexedDB       │   │
│  │  • IndexedDB 缓存查询（用于热切换）                  │   │
│  │  • fetch + 校验 + 缓存（SSR 未注入时）               │   │
│  │  • style 标签注入/切换                               │   │
│  │  • 热切换、版本回退、多版本管理                        │   │
│  │                                                     │   │
│  │  注意：IndexedDB 主要用于热切换和版本管理，          │   │
│  │  首屏 CSS 由 SSR 注入，客户端仅提取并缓存             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3.2 数据流图

### SSR 数据流
```
用户请求
  ↓
Next.js SSR
  ↓
获取 userInfo (Cookie/Token)
  ↓
fetch(userCSSUrl) → CSS 文本
  ↓
validateUserCss(cssText) → 校验通过/失败
  ↓
内联 <style id="user-theme-{version}">{css}</style>
  ↓
返回 HTML (包含用户 CSS)
```

### CSR 数据流
```
页面 Hydration
  ↓
ThemeProvider 初始化
  ↓
检查 DOM 中是否已有 SSR 注入的 style 标签
  ├─ 存在 → 提取 CSS 内容 → 存储到 IndexedDB（用于后续热切换）
  └─ 不存在 → 检查 IndexedDB 缓存
      ├─ 命中 → 使用缓存 CSS → 注入 style 标签
      └─ 未命中 → fetch(userCSSUrl)
          ↓
          validateUserCss(cssText)
          ↓
          存储到 IndexedDB
          ↓
          注入 style 标签
```

**说明：** IndexedDB 的主要用途是：
- **热切换**：用户切换主题版本时，从 IndexedDB 读取，避免网络请求
- **版本管理**：存储多个历史版本，支持版本回退
- **离线支持**：网络不可用时使用缓存版本
- **性能优化**：避免重复 fetch 相同的 CSS

### 热切换数据流
```
用户切换主题
  ↓
ThemeProvider.switchTheme(version)
  ↓
查找 IndexedDB 或 fetch 新版本
  ↓
删除旧 <style id="user-theme-{oldVersion}">
  ↓
注入新 <style id="user-theme-{newVersion}">
  ↓
更新 body.className (可选)
```

## 3.3 模块划分

| 模块 | 功能 | 实现位置 | 依赖 |
|------|------|----------|------|
| **CSS 校验模块** | PostCSS AST 解析与校验 | `lib/css-validator.ts` | `postcss`, `postcss-value-parser` |
| **缓存模块** | IndexedDB 多版本管理 | `lib/css-cache.ts` | `idb` |
| **注入模块** | style 标签注入/删除 | `lib/css-injector.ts` | 无 |
| **SSR 加载模块** | 服务端获取并注入用户 CSS | `app/layout.tsx` 或 `pages/_app.tsx` | Next.js Server API |
| **CSR ThemeProvider** | 客户端主题管理、热切换 | `components/ThemeProvider.tsx` | React Context |
| **API 接口模块** | 用户 CSS 提交、获取接口 | `app/api/user-theme/route.ts` | Next.js API Routes |

## 3.4 SSR 与 IndexedDB 的关系说明

**问题：** SSR 已经获取并注入了 CSS，为什么客户端还需要 IndexedDB？

**回答：** IndexedDB **不是**用于首屏加载，而是用于**热切换和版本管理**。

### 工作流程

1. **首屏加载（SSR）：**
   - 服务端获取用户 CSS → 校验 → 内联注入到 HTML
   - 客户端收到 HTML 时，CSS 已经在 DOM 中了
   - **客户端从 DOM 提取 CSS 并缓存到 IndexedDB**（用于后续热切换）

2. **热切换（CSR）：**
   - 用户切换主题版本时，从 IndexedDB 读取，**无需网络请求**
   - 如果 IndexedDB 中没有目标版本，才 fetch 并缓存

3. **版本管理：**
   - IndexedDB 存储多个历史版本
   - 支持版本回退和预览
   - 支持离线使用

### 优势

- **首屏性能：** SSR 注入，无 FOUC，无需等待客户端 fetch
- **切换性能：** 热切换从 IndexedDB 读取，几乎无延迟
- **离线支持：** 网络不可用时使用缓存版本
- **版本管理：** 支持多版本共存和回退

## 3.5 核心模块详细设计

### 3.4.1 CSS 校验模块

**职责：**
- 解析 CSS 文本为 PostCSS AST
- 遍历 AST 节点，检查违规规则
- 返回校验结果和错误信息

**校验规则：**
```typescript
// 禁止的选择器
const FORBIDDEN_SELECTORS = ['body', 'html', '*', 'html *', 'body *']

// 禁止的属性
const FORBIDDEN_PROPERTIES = {
  'position': (value) => value === 'fixed',
  'z-index': (value) => parseInt(value) > 1000,
  'display': (value) => value === 'none' && /* 特定上下文 */
}

// 禁止的 at-rule
const FORBIDDEN_AT_RULES = ['@import', '@font-face', '@charset', '@namespace']

// 允许的选择器模式
const ALLOWED_PATTERNS = [
  /^:root\s*$/,           // :root 变量覆盖
  /^\.user-theme\s/,      // .user-theme 作用域
  /^\.user-theme\s+[a-zA-Z-]+/, // .user-theme .class
]
```

### 3.4.2 缓存模块

**用途说明：**

IndexedDB 缓存**不是**用于首屏加载（SSR 已处理），而是用于：

1. **热切换优化**：用户切换主题版本时，从 IndexedDB 读取，避免网络请求延迟
2. **版本管理**：存储多个历史版本，支持版本回退和预览
3. **离线支持**：网络不可用时，使用缓存的版本
4. **性能优化**：避免重复 fetch 相同的 CSS 内容

**初始化流程：**

- SSR 已注入 CSS → 客户端从 DOM 提取并缓存到 IndexedDB
- SSR 未注入 CSS → 客户端从 IndexedDB 读取或 fetch

**数据结构：**
```typescript
interface UserCssRecord {
  version: string        // 版本标识 (userId-hash 或 userThemeVersion)
  css: string           // CSS 文本内容
  hash: string          // CSS 内容 hash (SHA-256)
  createdAt: number     // 创建时间戳
  userId?: string       // 用户 ID (可选)
}

interface CacheStore {
  userCss: {
    key: string         // version
    value: UserCssRecord
  }
  metadata: {
    key: string         // 'current-version' | 'versions-list'
    value: string | string[]
  }
}
```

**API：**
- `getCss(version: string): Promise<UserCssRecord | null>` - 获取指定版本的 CSS
- `setCss(record: UserCssRecord): Promise<void>` - 存储 CSS 到缓存
- `getAllVersions(): Promise<string[]>` - 获取所有版本列表
- `deleteCss(version: string): Promise<void>` - 删除指定版本
- `getCurrentVersion(): Promise<string | null>` - 获取当前版本
- `setCurrentVersion(version: string): Promise<void>` - 设置当前版本

### 3.4.3 注入模块

**职责：**
- 管理 `<style>` 标签的创建、更新、删除
- 确保官方 CSS 标签不被删除
- 支持多版本 style 标签共存（用于回退预览）

**API：**
- `injectStyle(id: string, css: string): void`
- `removeStyle(id: string): void`
- `updateStyle(id: string, css: string): void`
- `getStyleElement(id: string): HTMLStyleElement | null`

**实现细节：**
- style 标签 ID 格式：`user-theme-{version}`
- 官方 CSS 标签 ID：`official-theme`（受保护，不可删除）
- 注入位置：`document.head` 末尾（保证优先级）

### 3.4.4 SSR 加载模块

**实现位置：**
- App Router: `app/layout.tsx` (Server Component)
- Pages Router: `pages/_app.tsx` (getServerSideProps)

**流程：**
1. 服务端获取用户认证信息
2. 调用用户信息 API 获取 `userCSSUrl`、`userThemeVersion`、`userThemeHash`
3. 如果存在 `userCSSUrl`，fetch CSS 文本
4. 调用 `validateUserCss()` 校验
5. 校验通过后，内联注入到 HTML `<head>`

**错误处理：**
- CSS fetch 失败 → 跳过用户 CSS，使用官方主题
- CSS 校验失败 → 记录错误日志，跳过用户 CSS
- 超时处理：设置 3s 超时，超时则跳过

### 3.4.5 CSR ThemeProvider

**Context 结构：**
```typescript
interface ThemeContextValue {
  currentVersion: string | null
  availableVersions: string[]
  isLoading: boolean
  error: Error | null
  
  // 方法
  switchTheme: (version: string) => Promise<void>
  revertToOfficial: () => void
  refreshTheme: () => Promise<void>
  getThemeHistory: () => Promise<UserCssRecord[]>
}
```

**生命周期：**
1. **初始化阶段：**
   - 检查 IndexedDB 缓存
   - 如果缓存存在且 hash 匹配 → 直接使用
   - 如果缓存不存在或 hash 不匹配 → fetch 最新版本

2. **热切换阶段：**
   - 用户调用 `switchTheme(version)`
   - 查找缓存或 fetch 目标版本
   - 删除旧 style 标签
   - 注入新 style 标签
   - 更新 Context 状态

3. **版本回退：**
   - 支持回退到任意历史版本
   - 支持回退到官方主题（删除所有用户 CSS style 标签）
4. 功能需求

用户提交

上传 CSS 文件或 AI 生成文本

校验 CSS 安全性

提交接口保存，返回 URL + version + hash

缓存与版本管理

IndexedDB 存储用户 CSS

支持多版本历史

版本标识规则：userId + hash 或 userThemeVersion

支持回退到官方或历史版本

首屏 SSR

获取用户信息（Cookie / Token）

拉取用户 CSS → 校验 → 内联 <style> 注入 HTML head

官方 CSS 仍然加载

客户端热切换

删除旧 style 标签

注入新 style 标签

保留官方 CSS 不变

更新 body 或根节点 className（如 .user-theme）

安全策略

PostCSS 校验

禁止全局破坏样式规则

禁止高风险属性和 at-rule

扩展性

AI 生成 CSS → 校验 → 缓存 → 注入流程可复用

支持未来多用户、多版本、多主题切换

5. 技术栈

## 5.1 核心技术栈

| 类别 | 技术/库 | 版本 | 用途 |
|------|---------|------|------|
| **框架** | Next.js | 14+ | SSR/CSR 混合渲染 |
| **路由** | App Router | 14+ | 推荐使用 App Router |
| **语言** | TypeScript | 5.0+ | 类型安全 |
| **CSS 解析** | postcss | ^8.4.0 | CSS AST 解析 |
| **CSS 值解析** | postcss-value-parser | ^4.2.0 | CSS 值解析 |
| **缓存** | idb | ^8.0.0 | IndexedDB 封装 |
| **哈希** | crypto-js | ^4.2.0 | CSS 内容 hash (SHA-256) |
| **状态管理** | React Context | 18+ | 主题状态管理 |
| **HTTP 客户端** | fetch (native) | - | SSR/CSR 请求 |

## 5.2 依赖安装

```bash
# 核心依赖
npm install postcss postcss-value-parser idb crypto-js

# 类型定义
npm install -D @types/crypto-js
```

## 5.3 项目结构

```
NextUserTheme/
├── app/                          # App Router (推荐)
│   ├── layout.tsx               # SSR 用户 CSS 注入
│   ├── page.tsx
│   └── api/
│       └── user-theme/
│           ├── route.ts         # 用户主题 API
│           └── validate/route.ts # CSS 校验 API
├── components/
│   ├── ThemeProvider.tsx        # 客户端主题管理
│   └── ThemeSwitcher.tsx       # 主题切换 UI
├── lib/
│   ├── css-validator.ts         # CSS 校验模块
│   ├── css-cache.ts            # IndexedDB 缓存
│   ├── css-injector.ts         # Style 标签注入
│   ├── css-fetcher.ts         # CSS 获取工具
│   └── types.ts                # TypeScript 类型定义
├── styles/
│   ├── globals.css             # 官方主题 CSS
│   └── variables.css           # CSS 变量定义
├── public/                     # 静态资源
└── package.json
```

## 5.4 CSS 架构

### 官方 CSS 结构
```css
/* styles/variables.css */
:root {
  --color-primary: #0070f3;
  --color-secondary: #7928ca;
  --spacing-unit: 8px;
  /* ... 更多变量 */
}

/* styles/globals.css */
@import './variables.css';

body {
  background: var(--color-bg);
  color: var(--color-text);
  /* ... 使用 CSS 变量 */
}
```

### 用户 CSS 覆盖模式
```css
/* 用户提交的 CSS */
:root {
  --color-primary: #ff0000; /* 覆盖官方变量 */
}

.user-theme .header {
  background: var(--color-primary);
  /* 使用覆盖后的变量 */
}
```

## 5.5 环境变量

```env
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_THEME_API_ENDPOINT=/api/user-theme

# 服务端
THEME_CACHE_TTL=3600  # CSS 缓存 TTL (秒)
THEME_FETCH_TIMEOUT=3000  # CSS fetch 超时 (毫秒)
```

6. API 接口设计

## 6.1 用户信息接口

**请求：**
```typescript
GET /api/user/info
Headers: {
  Cookie: 'session=xxx' | Authorization: 'Bearer xxx'
}
```

**响应：**
```typescript
interface UserInfoResponse {
  userId: string
  userCSSUrl?: string          // 用户 CSS 文件 URL
  userThemeVersion?: string    // 当前主题版本
  userThemeHash?: string       // CSS 内容 hash
  hasCustomTheme: boolean
}
```

## 6.2 用户 CSS 提交接口

**请求：**
```typescript
POST /api/user-theme
Headers: {
  'Content-Type': 'application/json',
  Authorization: 'Bearer xxx'
}
Body: {
  css: string                  // CSS 文本内容
  source: 'upload' | 'ai'     // 来源
}
```

**响应：**
```typescript
interface SubmitThemeResponse {
  success: boolean
  version: string
  hash: string
  cssUrl: string
  errors?: ValidationError[]
}
```

## 6.3 CSS 校验接口

**请求：**
```typescript
POST /api/user-theme/validate
Body: {
  css: string
}
```

**响应：**
```typescript
interface ValidationResponse {
  valid: boolean
  errors: Array<{
    type: 'selector' | 'property' | 'at-rule' | 'other'
    message: string
    line?: number
    column?: number
  }>
}
```

## 6.4 CSS 获取接口

**请求：**
```typescript
GET /api/user-theme/{version}
Headers: {
  Authorization: 'Bearer xxx'
}
```

**响应：**
```typescript
Content-Type: text/css
Body: CSS 文本内容
```

7. 错误处理策略

## 7.1 SSR 错误处理

```typescript
// app/layout.tsx
try {
  const userInfo = await fetchUserInfo()
  if (userInfo?.userCSSUrl) {
    const css = await fetchUserCss(userInfo.userCSSUrl, { timeout: 3000 })
    const validation = validateUserCss(css)
    if (validation.valid) {
      // 注入用户 CSS
    } else {
      console.error('CSS validation failed:', validation.errors)
      // 使用官方主题
    }
  }
} catch (error) {
  // 网络错误、超时等
  console.error('Failed to load user theme:', error)
  // 降级到官方主题，不影响页面渲染
}
```

## 7.2 CSR 错误处理

```typescript
// components/ThemeProvider.tsx
const initializeTheme = async (version: string) => {
  try {
    setLoading(true)
    setError(null)
    
    // 1. 检查 SSR 注入的 CSS
    const ssrStyleElement = getStyleElement(`user-theme-${version}`)
    if (ssrStyleElement) {
      const css = ssrStyleElement.textContent || ''
      // 提取并缓存到 IndexedDB（用于后续热切换）
      await cache.setCss({ version, css, hash: computeHash(css) })
      return
    }
    
    // 2. SSR 未注入，检查 IndexedDB 缓存
    const cached = await cache.getCss(version)
    if (cached) {
      injectStyle(version, cached.css)
      return
    }
    
    // 3. 缓存未命中，Fetch 新版本
    const css = await fetchUserCss(version)
    const validation = validateUserCss(css)
    
    if (!validation.valid) {
      throw new Error('CSS validation failed')
    }
    
    // 4. 缓存并注入
    await cache.setCss({ version, css, hash: computeHash(css) })
    injectStyle(version, css)
    
  } catch (error) {
    setError(error)
    // 回退到官方主题或上一个可用版本
    revertToFallback()
  } finally {
    setLoading(false)
  }
}
```

## 7.3 错误类型

| 错误类型 | 处理策略 | 用户提示 |
|---------|---------|---------|
| **网络错误** | 使用缓存版本，无缓存则使用官方主题 | "网络错误，使用缓存主题" |
| **校验失败** | 拒绝应用，使用官方主题 | "CSS 不符合安全规范" |
| **超时** | 使用缓存或官方主题 | "加载超时，使用默认主题" |
| **IndexedDB 错误** | 降级到内存缓存或直接 fetch | "缓存不可用，使用在线版本" |

8. 性能优化

## 8.1 SSR 优化

- **并行请求：** userInfo 和 CSS fetch 可并行（如果 CSS URL 已知）
- **超时控制：** CSS fetch 设置 3s 超时，避免阻塞 SSR
- **缓存策略：** 服务端可缓存已验证的 CSS（Redis/Memory）

## 8.2 CSR 优化

- **SSR CSS 提取：** 从 DOM 提取 SSR 注入的 CSS，避免重复 fetch
- **IndexedDB 异步：** 所有 IndexedDB 操作不阻塞 UI
- **懒加载：** ThemeProvider 按需加载
- **防抖：** 主题切换操作防抖处理
- **预加载：** 可预加载常用版本到缓存（用于热切换）

## 8.3 缓存策略

**首屏加载（初始化）：**
```typescript
// 优先级
1. SSR 注入的 CSS（DOM 中已存在）→ 提取并缓存到 IndexedDB
2. IndexedDB 缓存（SSR 未注入时）
3. Network fetch（缓存未命中）
```

**热切换（用户操作）：**
```typescript
// 优先级
1. IndexedDB 缓存（快速切换，无网络延迟）
2. Network fetch（缓存未命中）→ 缓存后使用
```

**缓存失效：**
- Hash 不匹配 → 重新 fetch
- 版本不存在 → 回退到官方主题
- TTL 过期 → 重新验证（可选）
```

**注意：** IndexedDB 主要用于热切换优化，首屏 CSS 由 SSR 提供，客户端仅提取并缓存。

## 8.4 首屏优化 (FOUC 避免)

- **SSR 内联：** 用户 CSS 必须 SSR 内联，避免 FOUC
- **关键 CSS：** 官方 CSS 提取关键路径，优先加载
- **Preload：** 可预加载用户 CSS（如果已知 URL）

9. 实现示例

## 9.1 SSR 实现 (App Router)

```typescript
// app/layout.tsx
import { fetchUserInfo, fetchUserCss, validateUserCss } from '@/lib/css-fetcher'

export default async function RootLayout({ children }) {
  const userInfo = await fetchUserInfo()
  let userCss = ''
  
  if (userInfo?.userCSSUrl) {
    try {
      const cssText = await fetchUserCss(userInfo.userCSSUrl, { timeout: 3000 })
      const validation = validateUserCss(cssText)
      
      if (validation.valid) {
        userCss = cssText
      }
    } catch (error) {
      console.error('Failed to load user theme:', error)
    }
  }
  
  return (
    <html>
      <head>
        <link rel="stylesheet" href="/styles/globals.css" id="official-theme" />
        {userCss && (
          <style id={`user-theme-${userInfo.userThemeVersion}`}>
            {userCss}
          </style>
        )}
      </head>
      <body className={userCss ? 'user-theme' : ''}>
        <ThemeProvider initialVersion={userInfo?.userThemeVersion}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

## 9.2 CSR ThemeProvider 实现

```typescript
// components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { cssCache } from '@/lib/css-cache'
import { injectStyle, removeStyle, getStyleElement } from '@/lib/css-injector'
import { fetchUserCss, validateUserCss } from '@/lib/css-fetcher'

interface ThemeContextValue {
  currentVersion: string | null
  switchTheme: (version: string) => Promise<void>
  revertToOfficial: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ 
  children, 
  initialVersion 
}: { 
  children: React.ReactNode
  initialVersion?: string 
}) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(initialVersion || null)
  
  useEffect(() => {
    if (initialVersion) {
      initializeTheme(initialVersion)
    }
  }, [initialVersion])
  
  // 初始化：检查 SSR 注入的 CSS 或加载主题
  const initializeTheme = async (version: string) => {
    try {
      // 1. 检查 DOM 中是否已有 SSR 注入的 style 标签
      const ssrStyleId = `user-theme-${version}`
      const ssrStyleElement = getStyleElement(ssrStyleId)
      
      if (ssrStyleElement) {
        // SSR 已注入，提取 CSS 并缓存到 IndexedDB（用于后续热切换）
        const css = ssrStyleElement.textContent || ''
        if (css) {
          await cssCache.setCss({
            version,
            css,
            hash: await computeHash(css),
            createdAt: Date.now()
          })
        }
        setCurrentVersion(version)
        return
      }
      
      // 2. SSR 未注入，检查 IndexedDB 缓存
      const cached = await cssCache.getCss(version)
      if (cached) {
        injectStyle(version, cached.css)
        setCurrentVersion(version)
        return
      }
      
      // 3. 缓存未命中，fetch 新版本
      const css = await fetchUserCss(version)
      const validation = validateUserCss(css)
      
      if (!validation.valid) {
        throw new Error('CSS validation failed')
      }
      
      // 4. 缓存并注入
      await cssCache.setCss({
        version,
        css,
        hash: await computeHash(css),
        createdAt: Date.now()
      })
      
      injectStyle(version, css)
      setCurrentVersion(version)
      
    } catch (error) {
      console.error('Failed to load theme:', error)
      revertToOfficial()
    }
  }
  
  // 热切换：从 IndexedDB 读取或 fetch
  const switchTheme = async (version: string) => {
    try {
      // 删除旧版本 style 标签
      if (currentVersion) {
        removeStyle(`user-theme-${currentVersion}`)
      }
      
      // 1. 优先从 IndexedDB 读取（快速切换）
      const cached = await cssCache.getCss(version)
      if (cached) {
        injectStyle(version, cached.css)
        setCurrentVersion(version)
        return
      }
      
      // 2. 缓存未命中，fetch 并缓存
      const css = await fetchUserCss(version)
      const validation = validateUserCss(css)
      
      if (!validation.valid) {
        throw new Error('CSS validation failed')
      }
      
      await cssCache.setCss({
        version,
        css,
        hash: await computeHash(css),
        createdAt: Date.now()
      })
      
      injectStyle(version, css)
      setCurrentVersion(version)
      
    } catch (error) {
      console.error('Failed to switch theme:', error)
    }
  }
  
  const revertToOfficial = () => {
    if (currentVersion) {
      removeStyle(`user-theme-${currentVersion}`)
      setCurrentVersion(null)
    }
  }
  
  return (
    <ThemeContext.Provider value={{ currentVersion, switchTheme, revertToOfficial }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

10. 安全策略详细说明

## 10.1 CSS 校验规则

### 禁止的选择器
```typescript
const FORBIDDEN_SELECTORS = [
  'body',
  'html', 
  '*',
  'html *',
  'body *',
  '[style]',           // 内联样式选择器
  'script',            // 脚本标签
  'iframe',
  'object',
  'embed'
]
```

### 禁止的属性
```typescript
const FORBIDDEN_PROPERTIES = {
  'position': (value) => ['fixed', 'sticky'].includes(value),
  'z-index': (value) => {
    const num = parseInt(value)
    return !isNaN(num) && num > 1000
  },
  'display': (value, selector) => {
    // 禁止在 :root 上设置 display: none
    if (selector === ':root' && value === 'none') return true
    return false
  },
  'content': () => true,  // 禁止 content 属性（防止 XSS）
  'behavior': () => true, // 禁止 IE behavior
  'expression': () => true // 禁止 IE expression
}
```

### 禁止的 At-Rule
```typescript
const FORBIDDEN_AT_RULES = [
  '@import',      // 防止外部资源加载
  '@font-face',   // 防止字体加载
  '@charset',     // 字符集声明
  '@namespace',   // 命名空间
  '@keyframes',   // 动画（可选，根据需求）
  '@media',        // 媒体查询（可选，根据需求）
  '@supports'     // 特性查询（可选）
]
```

### 允许的模式
```typescript
// 只允许以下选择器模式
const ALLOWED_PATTERNS = [
  /^:root\s*$/,                    // :root 变量覆盖
  /^:root\s+[a-zA-Z-]+/,           // :root .class (错误，但允许)
  /^\.user-theme\s*$/,             // .user-theme
  /^\.user-theme\s+[a-zA-Z][\w-]*$/, // .user-theme .class
  /^\.user-theme\s+[a-zA-Z][\w-]*\s*:\s*(hover|focus|active)$/ // 伪类
]
```

## 10.2 内容安全策略 (CSP)

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'", // 允许内联 style
      "script-src 'self'",
      "font-src 'self'",
      "img-src 'self' data: https:",
    ].join('; ')
  }
]
```

## 10.3 XSS 防护

- **内容转义：** CSS 文本在注入前进行 HTML 转义
- **CSP 限制：** 禁止 `@import` 和外部资源
- **Hash 验证：** 服务端返回的 hash 必须与客户端计算一致

11. 测试策略

## 11.1 单元测试

```typescript
// __tests__/css-validator.test.ts
describe('CSS Validator', () => {
  it('应该拒绝全局选择器', () => {
    const css = 'body { color: red; }'
    const result = validateUserCss(css)
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('selector')
  })
  
  it('应该允许 :root 变量覆盖', () => {
    const css = ':root { --color-primary: red; }'
    const result = validateUserCss(css)
    expect(result.valid).toBe(true)
  })
  
  it('应该拒绝 position: fixed', () => {
    const css = '.user-theme { position: fixed; }'
    const result = validateUserCss(css)
    expect(result.valid).toBe(false)
  })
})
```

## 11.2 集成测试

```typescript
// __tests__/theme-provider.test.tsx
describe('ThemeProvider', () => {
  it('应该从 IndexedDB 加载缓存主题', async () => {
    // Mock IndexedDB
    // 测试缓存加载逻辑
  })
  
  it('应该支持主题切换', async () => {
    // 测试 switchTheme 功能
  })
  
  it('应该处理网络错误', async () => {
    // 测试错误处理和回退
  })
})
```

## 11.3 E2E 测试

```typescript
// e2e/theme.spec.ts
describe('用户主题系统', () => {
  it('应该 SSR 渲染用户主题', async () => {
    // 测试首屏是否包含用户 CSS
  })
  
  it('应该支持客户端热切换', async () => {
    // 测试主题切换 UI 交互
  })
  
  it('应该拒绝不安全的 CSS', async () => {
    // 测试 CSS 校验是否生效
  })
})
```

12. 部署与监控

## 12.1 部署检查清单

- [ ] 环境变量配置正确
- [ ] IndexedDB 兼容性测试（支持所有目标浏览器）
- [ ] SSR CSS 注入测试（无 FOUC）
- [ ] 错误监控集成（Sentry/LogRocket）
- [ ] 性能监控（Web Vitals）

## 12.2 监控指标

- **CSS 加载成功率：** SSR 和 CSR 的 CSS 加载成功率
- **校验失败率：** 用户提交的 CSS 校验失败比例
- **缓存命中率：** IndexedDB 缓存命中率
- **主题切换延迟：** 主题切换操作的平均耗时
- **错误类型分布：** 网络错误、校验错误、缓存错误等

## 12.3 日志记录

```typescript
// 关键操作日志
- CSS 校验失败：记录错误类型和用户 ID
- 主题切换：记录版本、耗时
- 缓存操作：记录命中/未命中
- 网络错误：记录错误信息和重试次数
```

13. 扩展性设计

## 13.1 多用户支持

- 缓存 key 包含 `userId`：`${userId}-${version}`
- API 接口支持用户隔离
- 权限控制：用户只能访问自己的主题

## 13.2 主题市场

- 支持主题分享和导入
- 主题预览功能
- 主题评分和收藏

## 13.3 AI 生成增强

- 集成 AI API（OpenAI/Claude）
- 自然语言转 CSS
- 主题风格迁移

14. 参考实现

## 14.1 核心文件清单

```
lib/
├── css-validator.ts      # CSS 校验核心逻辑
├── css-cache.ts         # IndexedDB 缓存封装
├── css-injector.ts      # Style 标签管理
├── css-fetcher.ts       # CSS 获取工具（SSR/CSR）
└── types.ts             # TypeScript 类型定义

components/
├── ThemeProvider.tsx    # 主题 Context Provider
└── ThemeSwitcher.tsx    # 主题切换 UI 组件

app/
├── layout.tsx           # SSR 用户 CSS 注入
└── api/
    └── user-theme/      # 主题相关 API
```

## 14.2 关键代码片段位置

- **CSS 校验：** `lib/css-validator.ts` - `validateUserCss()`
- **缓存操作：** `lib/css-cache.ts` - `getCss()`, `setCss()`
- **注入逻辑：** `lib/css-injector.ts` - `injectStyle()`, `removeStyle()`
- **SSR 注入：** `app/layout.tsx` - RootLayout 组件
- **CSR 管理：** `components/ThemeProvider.tsx` - ThemeProvider 组件

15. 方案可行性评估

## 15.1 技术可行性评估

### ✅ 高度可行的部分

1. **SSR CSS 注入**
   - ✅ Next.js 14+ 完全支持 Server Component 和 SSR
   - ✅ 内联 `<style>` 标签是标准做法
   - ✅ 技术成熟，无风险

2. **PostCSS 校验**
   - ✅ PostCSS AST 解析稳定可靠
   - ✅ 规则校验逻辑清晰
   - ✅ 已有成熟实践（如 Tailwind CSS）

3. **IndexedDB 缓存**
   - ✅ 浏览器原生支持，兼容性好
   - ✅ `idb` 库封装完善
   - ✅ 存储容量充足（通常 50MB+）

4. **客户端热切换**
   - ✅ DOM 操作简单直接
   - ✅ React Context 管理状态成熟
   - ✅ 性能开销小

### ⚠️ 需要关注的部分

1. **CSS 校验的完整性**
   - ⚠️ 需要持续维护禁止规则列表
   - ⚠️ 可能存在绕过校验的边界情况
   - ⚠️ 建议：定期审查和更新规则

2. **SSR 性能影响**
   - ⚠️ 每次 SSR 都需要 fetch 用户 CSS（除非服务端缓存）
   - ⚠️ 可能增加 SSR 响应时间
   - ✅ 建议：服务端缓存已验证的 CSS

3. **IndexedDB 兼容性**
   - ⚠️ 私有浏览模式可能限制存储
   - ⚠️ 某些浏览器可能禁用 IndexedDB
   - ✅ 建议：提供降级方案（内存缓存）

4. **CSS 作用域限制**
   - ⚠️ 仅允许 `:root` 和 `.user-theme` 可能限制用户自由度
   - ⚠️ 用户可能需要更灵活的选择器
   - ✅ 建议：根据实际需求调整允许规则

## 15.2 优缺点分析

### ✅ 优点

#### 1. 性能优势
- **首屏无 FOUC：** SSR 内联 CSS，避免样式闪烁
- **热切换快速：** IndexedDB 缓存，切换几乎无延迟
- **离线支持：** 网络不可用时使用缓存版本

#### 2. 用户体验
- **即时生效：** 主题切换无需刷新页面
- **版本管理：** 支持多版本回退和预览
- **无缝切换：** 官方 CSS 保持不变，用户 CSS 动态注入

#### 3. 安全性
- **CSS 校验：** PostCSS AST 严格校验，防止恶意 CSS
- **作用域限制：** 仅允许特定选择器，降低破坏风险
- **服务端校验：** SSR 和 CSR 双重校验

#### 4. 可维护性
- **模块化设计：** 校验、缓存、注入分离，易于维护
- **类型安全：** TypeScript 提供类型保障
- **扩展性强：** 支持未来功能扩展（主题市场、AI 生成等）

#### 5. 技术成熟度
- **标准技术栈：** Next.js、PostCSS、IndexedDB 都是成熟技术
- **社区支持：** 有丰富的文档和社区资源
- **兼容性好：** 支持现代浏览器

### ❌ 缺点

#### 1. 实现复杂度
- **双重校验：** SSR 和 CSR 都需要校验逻辑，代码重复
- **状态同步：** SSR 和 CSR 的 CSS 状态需要保持一致
- **错误处理：** 需要处理多种错误场景（网络、校验、缓存等）

#### 2. 性能开销
- **SSR 延迟：** 每次 SSR 都需要 fetch 用户 CSS（除非缓存）
- **IndexedDB 操作：** 异步操作可能影响初始化速度
- **CSS 解析：** PostCSS AST 解析需要计算资源

#### 3. 安全风险
- **校验绕过：** 可能存在绕过校验的边界情况
- **CSS 注入：** 即使校验通过，恶意 CSS 仍可能影响页面
- **XSS 风险：** 内联 style 标签需要 HTML 转义

#### 4. 限制性
- **选择器限制：** 仅允许 `:root` 和 `.user-theme`，用户自由度低
- **属性限制：** 禁止某些属性可能影响用户需求
- **媒体查询：** 禁止 `@media` 可能限制响应式设计

#### 5. 维护成本
- **规则维护：** 需要持续更新禁止规则列表
- **兼容性测试：** 需要测试多种浏览器和设备
- **错误监控：** 需要完善的错误监控和日志系统

#### 6. 存储限制
- **IndexedDB 配额：** 浏览器可能限制存储空间
- **多版本存储：** 多个版本可能占用大量空间
- **清理策略：** 需要实现版本清理机制

## 15.3 潜在风险与挑战

### 🔴 高风险

1. **CSS 校验绕过**
   - **风险：** 恶意用户可能找到绕过校验的方法
   - **影响：** 可能导致页面样式破坏或 XSS 攻击
   - **缓解：** 定期审查规则，使用白名单而非黑名单

2. **SSR 性能瓶颈**
   - **风险：** 大量用户同时访问，SSR fetch CSS 可能成为瓶颈
   - **影响：** 增加服务器负载，延长响应时间
   - **缓解：** 服务端缓存（Redis/Memory），CDN 加速

3. **IndexedDB 兼容性**
   - **风险：** 某些浏览器或隐私模式可能禁用 IndexedDB
   - **影响：** 热切换功能失效，用户体验下降
   - **缓解：** 提供降级方案（内存缓存、直接 fetch）

### 🟡 中风险

1. **CSS 作用域冲突**
   - **风险：** 用户 CSS 可能与官方 CSS 产生意外冲突
   - **影响：** 页面样式异常
   - **缓解：** 使用 CSS 变量和 `.user-theme` 作用域

2. **版本管理复杂性**
   - **风险：** 多版本管理可能增加代码复杂度
   - **影响：** 维护成本上升，bug 风险增加
   - **缓解：** 简化版本管理逻辑，限制版本数量

3. **错误处理不完善**
   - **风险：** 错误处理不当可能导致页面崩溃
   - **影响：** 用户体验差，系统不稳定
   - **缓解：** 完善的错误边界和降级方案

### 🟢 低风险

1. **CSS 文件大小**
   - **风险：** 用户 CSS 文件过大可能影响性能
   - **影响：** 加载时间增加，内存占用上升
   - **缓解：** 限制 CSS 文件大小，压缩 CSS

2. **浏览器兼容性**
   - **风险：** 某些旧浏览器可能不支持 IndexedDB
   - **影响：** 功能降级，但不影响核心功能
   - **缓解：** 提供 polyfill 或降级方案

## 15.4 改进建议

### 1. 安全增强
- ✅ **白名单模式：** 使用白名单而非黑名单，更安全
- ✅ **内容签名：** 对 CSS 内容进行签名验证
- ✅ **沙箱隔离：** 考虑使用 Shadow DOM 隔离用户 CSS

### 2. 性能优化
- ✅ **服务端缓存：** 使用 Redis 缓存已验证的 CSS
- ✅ **CDN 加速：** 将用户 CSS 托管到 CDN
- ✅ **懒加载：** 非关键 CSS 延迟加载

### 3. 用户体验
- ✅ **预览功能：** 允许用户预览主题效果
- ✅ **撤销功能：** 支持快速撤销到上一个版本
- ✅ **导入导出：** 支持主题导入导出

### 4. 可维护性
- ✅ **配置化规则：** 将校验规则配置化，易于调整
- ✅ **单元测试：** 完善的单元测试覆盖
- ✅ **文档完善：** 详细的开发文档和使用指南

## 15.5 结论

### 可行性评分：⭐⭐⭐⭐ (4/5)

**总体评价：** 方案技术可行，但需要关注安全性和性能优化。

**推荐实施：** ✅ 推荐实施，但需要：
1. 完善 CSS 校验规则（白名单模式）
2. 实现服务端缓存（Redis）
3. 提供完善的错误处理和降级方案
4. 限制用户 CSS 文件大小和复杂度
5. 完善的测试和监控

**适用场景：**
- ✅ 中小型项目，用户量适中
- ✅ 需要高度自定义主题的场景
- ✅ 对性能要求不是极致的场景

**不适用场景（基础方案）：**
- ❌ 超大型项目，用户量巨大（需要更复杂的缓存策略）→ **见 15.6 大规模用户优化方案**
- ❌ 对安全性要求极高的场景（金融、医疗等）
- ❌ 需要支持所有旧浏览器的场景

## 15.6 大规模用户优化方案

针对用户量巨大的场景，需要采用更复杂的缓存策略和架构优化。

### 15.6.1 多级缓存架构

```
用户请求
  ↓
CDN 边缘缓存 (L1) → 命中率 80-90%
  ↓ (未命中)
Next.js SSR 服务
  ↓
Redis 内存缓存 (L2) → 命中率 90-95%
  ↓ (未命中)
数据库查询 (L3)
  ↓
存储到 Redis + CDN
```

**实现方案：**

```typescript
// lib/css-fetcher.ts
async function fetchUserCssWithCache(
  userId: string,
  version: string,
  options?: { skipCache?: boolean }
): Promise<string> {
  const cacheKey = `user-css:${userId}:${version}`
  
  // 1. 检查 Redis 缓存
  if (!options?.skipCache) {
    const cached = await redis.get(cacheKey)
    if (cached) {
      // 更新访问时间，用于 LRU 淘汰
      await redis.expire(cacheKey, 3600)
      return cached
    }
  }
  
  // 2. 从数据库或文件系统获取
  const css = await db.getUserCss(userId, version)
  
  // 3. 校验（如果未校验过）
  const validation = await validateUserCss(css)
  if (!validation.valid) {
    throw new Error('CSS validation failed')
  }
  
  // 4. 存储到 Redis（异步，不阻塞）
  redis.set(cacheKey, css, { ex: 3600 }).catch(console.error)
  
  return css
}
```

### 15.6.2 CDN 分发策略

**方案：** 将用户 CSS 文件托管到 CDN，通过 URL 参数控制缓存。

```typescript
// 生成 CDN URL
function generateCssUrl(userId: string, version: string, hash: string): string {
  // 使用 hash 作为缓存键，确保内容变化时缓存失效
  return `https://cdn.example.com/themes/${userId}/${version}.css?v=${hash}`
}

// SSR 中使用
const cssUrl = generateCssUrl(userId, version, hash)
// CDN 会自动缓存，减少源站压力
```

**CDN 配置：**
- **缓存时间：** 1 小时（通过 `v` 参数控制版本）
- **边缘节点：** 全球分布，就近访问
- **回源策略：** 缓存未命中时回源到 Next.js 服务

### 15.6.3 数据库优化

**1. 索引优化**

```sql
-- 用户 CSS 表索引
CREATE INDEX idx_user_theme ON user_themes(user_id, version);
CREATE INDEX idx_user_theme_active ON user_themes(user_id, is_active);
CREATE INDEX idx_theme_hash ON user_themes(hash);

-- 复合索引用于快速查询
CREATE INDEX idx_user_active_version ON user_themes(user_id, is_active, version DESC);
```

**2. 分表策略**

```typescript
// 按用户 ID 分表（分片）
function getTableName(userId: string): string {
  const shard = parseInt(userId.slice(-2), 16) % 16
  return `user_themes_${shard}`
}

// 或者按时间分表
function getTableNameByDate(): string {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  return `user_themes_${month}`
}
```

**3. 读写分离**

```typescript
// 读操作使用从库
const readDb = getReadReplica()
const css = await readDb.getUserCss(userId, version)

// 写操作使用主库
const writeDb = getPrimaryDb()
await writeDb.saveUserCss(userId, version, css)
```

### 15.6.4 异步处理架构

**方案：** CSS 校验和存储异步化，不阻塞用户请求。

```typescript
// app/api/user-theme/route.ts
export async function POST(request: Request) {
  const { css, userId } = await request.json()
  
  // 1. 快速响应（返回任务 ID）
  const taskId = generateTaskId()
  
  // 2. 异步处理（不阻塞）
  processThemeAsync(taskId, userId, css).catch(console.error)
  
  return Response.json({
    success: true,
    taskId,
    status: 'processing'
  })
}

// 后台任务处理
async function processThemeAsync(
  taskId: string,
  userId: string,
  css: string
) {
  try {
    // 1. 校验 CSS
    const validation = await validateUserCss(css)
    if (!validation.valid) {
      await updateTaskStatus(taskId, 'failed', validation.errors)
      return
    }
    
    // 2. 计算 hash
    const hash = await computeHash(css)
    
    // 3. 存储到数据库
    const version = await db.saveUserCss(userId, css, hash)
    
    // 4. 预热缓存
    await redis.set(`user-css:${userId}:${version}`, css, { ex: 3600 })
    
    // 5. 上传到 CDN（可选）
    await uploadToCDN(userId, version, css, hash)
    
    // 6. 更新任务状态
    await updateTaskStatus(taskId, 'completed', { version, hash })
    
  } catch (error) {
    await updateTaskStatus(taskId, 'failed', { error: error.message })
  }
}
```

### 15.6.5 缓存预热策略

**方案：** 提前加载热门用户的 CSS 到缓存。

```typescript
// 定时任务：预热缓存
async function warmupCache() {
  // 1. 获取热门用户列表（最近 7 天有访问）
  const activeUsers = await db.getActiveUsers(7)
  
  // 2. 批量加载到 Redis
  const pipeline = redis.pipeline()
  
  for (const user of activeUsers) {
    const css = await db.getUserCss(user.id, user.currentVersion)
    pipeline.set(`user-css:${user.id}:${user.currentVersion}`, css, { ex: 3600 })
  }
  
  await pipeline.exec()
}

// 每小时执行一次
setInterval(warmupCache, 3600000)
```

### 15.6.6 限流和降级

**1. 限流策略**

```typescript
// 使用 Redis 实现滑动窗口限流
import { RateLimiterRedis } from 'rate-limiter-flexible'

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'css-fetch',
  points: 100, // 100 次请求
  duration: 60, // 60 秒
})

// 在 SSR 中使用
try {
  await rateLimiter.consume(`user:${userId}`)
  const css = await fetchUserCss(userId, version)
} catch (rejRes) {
  // 超过限制，使用默认主题
  return null
}
```

**2. 降级策略**

```typescript
// 多级降级
async function fetchUserCssWithFallback(
  userId: string,
  version: string
): Promise<string | null> {
  try {
    // 1. 尝试从 Redis 获取
    const cached = await redis.get(`user-css:${userId}:${version}`)
    if (cached) return cached
    
    // 2. 尝试从数据库获取
    const css = await db.getUserCss(userId, version)
    
    // 3. 异步更新缓存（不阻塞）
    redis.set(`user-css:${userId}:${version}`, css, { ex: 3600 })
      .catch(console.error)
    
    return css
    
  } catch (error) {
    // 4. 降级：返回 null，使用官方主题
    console.error('Failed to fetch user CSS:', error)
    return null
  }
}
```

### 15.6.7 监控和告警

**关键指标：**

```typescript
// 监控指标
interface Metrics {
  // 缓存命中率
  cacheHitRate: number
  
  // CSS 加载延迟
  cssLoadLatency: {
    p50: number
    p95: number
    p99: number
  }
  
  // 错误率
  errorRate: {
    network: number
    validation: number
    database: number
  }
  
  // 并发请求数
  concurrentRequests: number
  
  // Redis 连接池使用率
  redisPoolUsage: number
}

// 告警规则
const alerts = {
  cacheHitRate: { threshold: 0.8, operator: '<' },
  cssLoadLatencyP95: { threshold: 500, operator: '>' }, // 500ms
  errorRate: { threshold: 0.05, operator: '>' }, // 5%
}
```

### 15.6.8 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       用户请求                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    CDN 边缘节点 (L1)                          │
│  • 全球分布，就近访问                                         │
│  • 缓存命中率: 80-90%                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ (未命中)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js SSR 服务 (负载均衡)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  限流 → Redis 缓存 (L2) → 数据库 (L3)                │   │
│  │  • Redis 命中率: 90-95%                               │   │
│  │  • 降级策略: 官方主题                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    后台任务队列                                │
│  • CSS 校验和存储（异步）                                    │
│  • 缓存预热                                                  │
│  • CDN 上传                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 15.6.9 实施建议

**阶段一：基础优化（支持 1-10 万用户）**
1. ✅ 实现 Redis 缓存（L2）
2. ✅ SSR 超时和降级
3. ✅ 基础限流

**阶段二：CDN 分发（支持 10-100 万用户）**
1. ✅ 集成 CDN（Cloudflare/AWS CloudFront）
2. ✅ 缓存预热策略
3. ✅ 监控和告警

**阶段三：高级优化（支持 100 万+ 用户）**
1. ✅ 数据库分表/分片
2. ✅ 读写分离
3. ✅ 异步任务队列（Bull/Redis Queue）
4. ✅ 多区域部署

**性能目标：**
- **缓存命中率：** > 95%
- **CSS 加载延迟（P95）：** < 200ms
- **SSR 响应时间：** < 500ms
- **错误率：** < 0.1%

### 15.6.10 成本估算

**假设：100 万用户，10% 使用自定义主题**

| 项目 | 月成本（估算） |
|------|---------------|
| Redis 缓存（AWS ElastiCache） | $200-500 |
| CDN（Cloudflare Pro） | $20-100 |
| 数据库（RDS/自建） | $300-1000 |
| 负载均衡 | $50-200 |
| **总计** | **$570-1800/月** |

**优化建议：**
- 使用 Redis Cluster 提高可用性
- CDN 按流量计费，优化缓存策略可降低成本
- 数据库使用读写分离，降低主库压力

15. MD / Cursor 提示词用途

本文档可用于提示 AI 或代码生成工具：

**架构要点：**
- SSR + CSR 混合渲染
- 模块化设计（校验、缓存、注入、管理）
- 安全优先的 CSS 校验策略

**功能模块：**
- CSS 校验模块（PostCSS AST）
- IndexedDB 缓存模块（多版本管理）
- Style 标签注入模块（热切换）
- SSR 加载模块（首屏优化）
- CSR ThemeProvider（客户端管理）

**技术栈：**
- Next.js 14+ (App Router)
- PostCSS + postcss-value-parser
- IndexedDB (idb)
- TypeScript 5.0+
**可用于自动生成：**
- `ThemeProvider` 组件
- `css-validator.ts` 校验逻辑
- `css-cache.ts` 缓存封装
- `css-injector.ts` 注入工具
- SSR 用户 CSS 注入逻辑（`app/layout.tsx`）
- 热切换和版本回退逻辑
