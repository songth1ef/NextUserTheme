# Next.js 用户自定义主题系统

支持用户自定义 CSS 主题、色彩模式和界面语言，实现 SSR 首屏渲染无闪烁、客户端热切换、多版本管理和本地缓存。

> **系统定位：** CSS 主题定制系统，专注于样式/主题定制，而非低代码搭建平台。用户可修改已有组件的视觉样式，但不能创建新组件或修改页面结构。

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:3000

```bash
# 生产构建
npm run build
npm start
```

## 核心功能

### 1. CSS 主题定制

用户可提交自定义 CSS，服务端校验后持久化存储，支持多版本管理。

**CSS 校验规则：**
- 允许：`:root { --var: value; }`（CSS 变量覆盖）
- 允许：`.user-theme .class { ... }`（作用域样式）
- 禁止：`body`、`html`、`*` 全局选择器
- 禁止：`position: fixed`、`z-index > 1000` 危险属性
- 禁止：`@import`、`@font-face`、`url()` 外部资源

**版本管理：** 每次提交生成独立版本（基于 SHA-256 哈希），支持切换、重命名、删除和回退至官方主题。

### 2. 色彩模式

支持三种模式：`light`（浅色）、`dark`（深色）、`system`（跟随系统）。

- `system` 模式通过 `prefers-color-scheme` 媒体查询实时响应系统切换
- 用户设置持久化存储于服务端
- SSR 阶段内联初始化脚本，避免深浅色闪烁

### 3. 界面国际化（i18n）

用户可上传自定义语言包替换界面文字，内置简体中文。

- 用户语言包与内置包合并（用户包优先），保证兜底
- SSR 阶段直接注入翻译，无需客户端等待
- 客户端通过 IndexedDB 缓存当前翻译
- 支持插值语法：`t('key', { name: 'value' })`

### 4. SSR 首屏无闪烁

`app/layout.tsx` 在服务端并行获取主题 CSS、色彩模式、翻译，全部内联到 HTML：

- 用户 CSS 以 `<style>` 标签内联注入 `<head>`
- 色彩模式通过 `data-color-mode` 属性设置，`system` 模式额外注入初始化脚本
- 翻译直接作为 `initialTranslations` prop 传入，无需客户端再次请求

所有数据获取均设有超时保护（默认 3000ms），超时后降级为默认值。

### 5. 客户端缓存

- **主题 CSS**：IndexedDB（`lib/css-cache.ts`），缓存版本内容和当前版本指针
- **翻译数据**：IndexedDB（`lib/i18n-cache.ts`），缓存当前激活语言包
- **服务端**：内存缓存 + 文件系统，TTL 可配置

## 项目结构

```
NextUserTheme/
├── app/
│   ├── layout.tsx                    # SSR 入口：并行获取主题/色彩/翻译并内联注入
│   ├── page.tsx                      # 主页面
│   └── api/
│       ├── color-mode/
│       │   └── route.ts              # GET/PUT 色彩模式
│       ├── user-theme/
│       │   ├── route.ts              # POST 提交主题
│       │   ├── current/route.ts      # PUT 切换当前版本
│       │   ├── validate/route.ts     # POST 校验 CSS
│       │   ├── versions/route.ts     # GET 版本列表（含详情）
│       │   └── [version]/route.ts   # GET 获取 CSS / PUT 重命名 / DELETE 删除
│       ├── user-i18n/
│       │   ├── packs/route.ts        # GET 语言包列表 / POST 创建
│       │   ├── packs/[packId]/route.ts  # GET/PUT/DELETE 单个语言包
│       │   └── active/route.ts       # GET/PUT 激活语言包
│       ├── i18n/
│       │   ├── builtin/route.ts      # GET 内置翻译
│       │   └── keys/route.ts         # GET 可翻译 key 定义列表
│       └── user/info/route.ts        # GET 用户信息及当前主题状态
├── components/
│   ├── ThemeProvider.tsx             # 主题 Context（切换/删除/重命名/回退）
│   ├── ThemeSwitcher.tsx             # 主题切换 UI
│   ├── ThemePreview.tsx              # 主题预览组件
│   ├── ColorModeProvider.tsx         # 色彩模式 Context
│   ├── I18nProvider.tsx              # 国际化 Context
│   ├── LocaleManager.tsx             # 语言包管理 UI
│   ├── LocaleSwitcher.tsx            # 语言切换 UI
│   └── PageHeader.tsx                # 页面顶部导航
├── lib/
│   ├── css-validator.ts              # PostCSS AST 校验
│   ├── css-cache.ts                  # IndexedDB 主题缓存
│   ├── css-injector.ts               # <style> 标签注入/移除
│   ├── css-hash.ts                   # SHA-256 哈希计算
│   ├── i18n-cache.ts                 # IndexedDB 翻译缓存
│   ├── i18n-types.ts                 # 国际化类型定义
│   ├── i18n-interpolate.ts           # 插值解析
│   ├── types.ts                      # 公共类型
│   └── server/
│       ├── theme-store.ts            # 服务端主题存储（文件系统 + 内存缓存）
│       ├── locale-store.ts           # 服务端语言包存储（文件系统 + 内存缓存）
│       └── user-session.ts           # 用户 ID 提取
├── locales/
│   ├── zh-CN.json                    # 内置简体中文翻译
│   ├── en.json                       # 英文翻译（示例）
│   └── keys.ts                       # 可翻译 key 定义
└── public/
    ├── official-theme.css            # 官方基础主题
    └── locales/en.json               # 公开语言包示例
```

**服务端数据存储：**
```
.data/
├── user-themes/{userId}/
│   ├── manifest.json                 # 版本列表 + 当前版本 + 色彩模式
│   ├── {version}.css                 # CSS 文件
│   └── {version}.json                # 版本元数据
└── user-locales/{userId}/
    ├── manifest.json                 # 语言包列表 + 激活包 ID
    └── {packId}.json                 # 语言包数据
```

## API 接口

### 主题 API

#### `POST /api/user-theme` — 提交 CSS 主题

```json
// Request
{ "css": ":root { --color-primary: #ff4d4f; }", "source": "ai" | "upload" }

// Response
{ "success": true, "version": "demo-user-abc123def456", "hash": "sha256...", "cssUrl": "/api/user-theme/demo-user-abc123def456" }
```

#### `GET /api/user-theme/[version]` — 获取指定版本 CSS

响应 `text/css`。仅允许获取属于当前用户的版本（前缀校验）。

#### `PUT /api/user-theme/[version]` — 重命名版本

```json
// Request
{ "versionName": "我的红色主题" }
```

#### `DELETE /api/user-theme/[version]` — 删除版本

#### `PUT /api/user-theme/current` — 切换当前版本

```json
// Request
{ "version": "demo-user-abc123def456" }  // 或 null 回退官方主题
```

#### `GET /api/user-theme/versions` — 版本列表（含详情）

```json
// Response
{
  "versions": [
    { "version": "demo-user-abc123", "versionName": "我的主题", "hash": "...", "createdAt": 1700000000000 }
  ]
}
```

#### `POST /api/user-theme/validate` — 校验 CSS

```json
// Request
{ "css": ":root { --color-primary: #ff4d4f; }" }

// Response
{ "valid": true, "errors": [] }
// 或
{ "valid": false, "errors": [{ "message": "禁止使用 body 选择器" }] }
```

### 色彩模式 API

#### `GET /api/color-mode` — 获取当前色彩模式

```json
{ "mode": "dark" }
```

#### `PUT /api/color-mode` — 设置色彩模式

```json
// Request
{ "mode": "light" | "dark" | "system" }
```

### 国际化 API

#### `GET /api/i18n/keys` — 获取可翻译 key 定义列表

```json
{ "keys": [{ "key": "theme.title", "description": "主题系统标题", "category": "theme" }] }
```

#### `GET /api/i18n/builtin` — 获取内置翻译

#### `GET /api/user-i18n/packs` — 语言包列表

```json
{ "packs": [{ "id": "...", "name": "English", "keyCount": 42, "createdAt": 0, "updatedAt": 0 }] }
```

#### `POST /api/user-i18n/packs` — 创建语言包

```json
// Request
{ "name": "English", "translations": { "theme.title": "Theme System" } }
```

#### `GET/PUT/DELETE /api/user-i18n/packs/[packId]` — 查看/更新/删除单个语言包

#### `GET /api/user-i18n/active` — 获取当前激活语言包

#### `PUT /api/user-i18n/active` — 切换激活语言包

```json
// Request
{ "packId": "demo-user-abc123" }  // 或 null 回退内置翻译
```

## 在组件中使用

### 主题

```tsx
'use client'
import { useTheme } from '@/components/ThemeProvider'

export function MyComponent() {
  const { currentVersion, versionDetails, switchTheme, revertToOfficial, deleteVersion, renameVersion } = useTheme()

  return (
    <div>
      <p>当前版本: {currentVersion ?? '官方主题'}</p>
      <button onClick={() => switchTheme('demo-user-abc123')}>切换</button>
      <button onClick={() => renameVersion('demo-user-abc123', '红色主题')}>重命名</button>
      <button onClick={() => deleteVersion('demo-user-abc123')}>删除</button>
      <button onClick={revertToOfficial}>回退官方</button>
    </div>
  )
}
```

### 色彩模式

```tsx
'use client'
import { useColorMode } from '@/components/ColorModeProvider'

export function ModeToggle() {
  const { colorMode, resolvedMode, setColorMode } = useColorMode()

  return (
    <select value={colorMode} onChange={e => setColorMode(e.target.value as any)}>
      <option value="light">浅色</option>
      <option value="dark">深色</option>
      <option value="system">跟随系统</option>
    </select>
  )
}
```

### 国际化

```tsx
'use client'
import { useI18n } from '@/components/I18nProvider'

export function MyText() {
  const { t, switchPack, availablePacks } = useI18n()

  return (
    <div>
      <h1>{t('theme.title')}</h1>
      <p>{t('greeting', { name: '用户' })}</p>
    </div>
  )
}
```

### 提交自定义主题

```typescript
async function submitTheme(css: string) {
  const res = await fetch('/api/user-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ css, source: 'upload' })
  })
  const data = await res.json()
  if (data.success) {
    console.log('版本:', data.version)
  }
}
```

## 技术栈

| 类别 | 技术 |
|------|------|
| Framework | Next.js 14+ App Router |
| Language | TypeScript 5.0+ |
| CSS 校验 | PostCSS 8.5+ + postcss-value-parser |
| 客户端缓存 | IndexedDB（idb 8） |
| 哈希计算 | crypto-js SHA-256 |
| 服务端存储 | 本地文件系统（`.data/`） |

## 环境变量

```env
# .env.local

# SSR 数据获取超时（毫秒），超时后降级为默认值，默认 3000
THEME_FETCH_TIMEOUT=3000

# 服务端主题内存缓存 TTL（秒），默认 3600
THEME_CACHE_TTL=3600

# 服务端翻译内存缓存 TTL（秒），默认 3600
I18N_CACHE_TTL=3600
```

## 开发

```bash
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint 检查
npm run build       # 生产构建
```

## 功能清单

- SSR 首屏渲染（无 FOUC，无色彩闪烁）
- CSS 主题热切换（无需刷新页面）
- 多版本管理（创建、切换、重命名、删除、回退）
- CSS 安全校验（PostCSS AST，防止注入）
- 色彩模式（light / dark / system，跟随系统）
- 界面国际化（用户语言包，SSR 注入，IndexedDB 缓存）
- 离线支持（IndexedDB 缓存主题和翻译）
- 服务端内存缓存（TTL 可配置）

## 限制

- CSS 仅允许 `:root` 变量覆盖和 `.user-theme` 作用域选择器
- 不支持 `@import`、`@font-face`、外部 `url()` 资源
- 服务端存储使用本地文件系统，不适合多实例部署（需替换为数据库）
- 需要现代浏览器（IndexedDB、`matchMedia` API）

## 许可证

MIT
