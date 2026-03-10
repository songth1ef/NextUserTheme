# 功能文档

## 1. 系统定位

### 1.1 核心定位

**本系统是：CSS 主题定制系统，而非低代码搭建平台**

| 特性 | 本系统（主题定制） | 低代码平台 |
|------|------------------|-----------|
| **主要功能** | 样式/主题定制 | 页面/应用搭建 |
| **操作对象** | 已有组件的样式 | 组件/页面结构 |
| **输出产物** | CSS 样式文件 | 完整页面/应用 |
| **开发方式** | 开发者编写组件代码 | 用户拖拽组件 |
| **用户能力** | 修改样式属性 | 创建页面结构 |

### 1.2 功能边界

**支持：**
- 用户自定义 CSS 样式（颜色、尺寸、边框等）
- 覆盖官方主题的视觉样式
- 多版本主题管理和切换
- 可视化样式编辑器（未来）

**不支持：**
- 创建新组件或修改页面结构（DOM 树）
- 添加业务逻辑或数据绑定

### 1.3 系统演进路径

```
阶段 1：CSS 主题系统（当前）
  → 用户提交 CSS → 校验 → 应用样式

阶段 2：可视化样式编辑器（未来）
  → DOM 树选择 → 属性编辑 → 生成 CSS → 应用样式

阶段 3：低代码平台（可选扩展，独立模块）
  → 组件库 → 拖拽布局 → 样式定制 → 数据绑定 → 生成应用
```

---

## 2. 核心功能

### 2.1 用户提交 CSS

- 支持上传 CSS 文件或 AI 生成文本
- 提交前必须通过 CSS 安全性校验
- 提交接口保存后返回 URL + version + hash

### 2.2 CSS 校验（PostCSS AST）

使用 PostCSS AST 进行解析与校验，返回校验结果和错误信息。

#### 允许的选择器

```css
/* :root 变量覆盖 */
:root { --color-primary: #ff4d4f; }

/* .user-theme 作用域选择器 */
.user-theme .theme-button-primary { background: var(--color-primary) !important; }

/* 伪类选择器 */
.user-theme .theme-button-primary:hover { transform: translateY(-1px); }
```

#### 禁止的选择器

```css
body { }       /* 全局选择器 */
html { }
* { }
[style] { }    /* 危险选择器 */
script { }
iframe { }
```

#### 禁止的属性

```css
position: fixed;        /* 危险定位 */
position: sticky;
z-index: 2000;          /* z-index > 1000 */
background: url('http://...');  /* 外部资源 */
content: '...';         /* 防止 XSS */
behavior: url(...);     /* IE 专属 */
expression: ...;        /* IE 专属 */
```

#### 禁止的 At-Rule

```css
@import       /* 防止外部资源加载 */
@font-face    /* 防止字体加载 */
@charset
@namespace
@keyframes    /* 可选 */
@media        /* 可选 */
@supports     /* 可选 */
```

#### 校验规则定义

```typescript
const FORBIDDEN_SELECTORS = ['body', 'html', '*', 'html *', 'body *', '[style]', 'script', 'iframe', 'object', 'embed']

const FORBIDDEN_PROPERTIES = {
  'position': (value) => ['fixed', 'sticky'].includes(value),
  'z-index': (value) => parseInt(value) > 1000,
  'content': () => true,
  'behavior': () => true,
  'expression': () => true
}

const FORBIDDEN_AT_RULES = ['@import', '@font-face', '@charset', '@namespace', '@keyframes', '@media', '@supports']

const ALLOWED_PATTERNS = [
  /^:root\s*$/,
  /^\.user-theme\s*$/,
  /^\.user-theme\s+[a-zA-Z][\w-]*$/,
  /^\.user-theme\s+[a-zA-Z][\w-]*\s*:\s*(hover|focus|active)$/
]
```

### 2.3 缓存策略（IndexedDB）

IndexedDB **不用于**首屏加载（SSR 已处理），而用于：

1. **热切换优化**：用户切换主题版本时从 IndexedDB 读取，避免网络请求
2. **版本管理**：存储多个历史版本，支持回退和预览
3. **离线支持**：网络不可用时使用缓存版本
4. **性能优化**：避免重复 fetch 相同 CSS

**数据结构：**

```typescript
interface UserCssRecord {
  version: string
  css: string
  hash: string       // SHA-256
  createdAt: number
  userId?: string
}
```

**缓存 API：**
- `getCss(version): Promise<UserCssRecord | null>`
- `setCss(record: UserCssRecord): Promise<void>`
- `getAllVersions(): Promise<string[]>`
- `deleteCss(version): Promise<void>`
- `getCurrentVersion(): Promise<string | null>`
- `setCurrentVersion(version): Promise<void>`

### 2.4 加载策略

**SSR 加载流程：**
```
用户请求 → Next.js SSR → 获取 userInfo → fetch CSS → validateUserCss → 内联 <style> 注入 HTML head → 返回 HTML
```

**CSR 加载流程：**
```
Hydration → ThemeProvider 初始化
  → 检查 DOM 中 SSR 注入的 style 标签
    ├─ 存在 → 提取 CSS → 存储到 IndexedDB
    └─ 不存在 → 检查 IndexedDB
        ├─ 命中 → 注入 style 标签
        └─ 未命中 → fetch → 校验 → 缓存 → 注入
```

**热切换流程：**
```
用户切换主题 → switchTheme(version) → 查找 IndexedDB 或 fetch
  → 删除旧 <style> → 注入新 <style> → 更新状态
```

### 2.5 安全策略

- **CSS 校验**：PostCSS AST 严格校验，禁止全局破坏性规则
- **作用域限制**：仅允许 `:root` 和 `.user-theme` 选择器
- **CSP 策略**：`style-src 'self' 'unsafe-inline'`，禁止外部资源
- **Hash 验证**：服务端返回 hash 与客户端计算一致
- **XSS 防护**：CSS 文本注入前进行 HTML 转义

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                              │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP Request
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js SSR 服务端                         │
│  1. 获取 userInfo (Cookie/Token)                             │
│  2. fetch 用户 CSS (userCSSUrl)                              │
│  3. validateUserCss() 校验                                   │
│  4. 内联 <style> 注入 HTML head                               │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTML + Inline CSS
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      客户端 Hydration                         │
│  ThemeProvider (Client)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐          │
│  │ CSS 校验模块  │  │ 缓存模块      │  │ 注入模块   │          │
│  │ PostCSS AST  │  │ IndexedDB    │  │ Style Tag │          │
│  └──────────────┘  └──────────────┘  └───────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 模块划分

| 模块 | 功能 | 文件路径 | 依赖 |
|------|------|----------|------|
| **CSS 校验** | PostCSS AST 解析与校验 | `lib/css-validator.ts` | `postcss`, `postcss-value-parser` |
| **缓存** | IndexedDB 多版本管理 | `lib/css-cache.ts` | `idb` |
| **注入** | style 标签注入/删除 | `lib/css-injector.ts` | 无 |
| **SSR 加载** | 服务端获取并注入用户 CSS | `app/layout.tsx` | Next.js Server API |
| **CSR 管理** | 客户端主题管理、热切换 | `components/ThemeProvider.tsx` | React Context |
| **API 接口** | 用户 CSS 提交、获取 | `app/api/user-theme/route.ts` | Next.js API Routes |

### 3.3 注入模块设计

- style 标签 ID 格式：`user-theme-{version}`
- 官方 CSS 标签 ID：`official-theme`（受保护，不可删除）
- 注入位置：`document.head` 末尾（保证优先级）

**API：**
- `injectStyle(id, css): void`
- `removeStyle(id): void`
- `updateStyle(id, css): void`
- `getStyleElement(id): HTMLStyleElement | null`

### 3.4 CSR ThemeProvider

```typescript
interface ThemeContextValue {
  currentVersion: string | null
  availableVersions: string[]
  isLoading: boolean
  error: Error | null
  switchTheme: (version: string) => Promise<void>
  revertToOfficial: () => void
  refreshTheme: () => Promise<void>
  getThemeHistory: () => Promise<UserCssRecord[]>
}
```

---

## 4. CSS 类名规范

### 4.1 命名规则

- **前缀：** `theme-`（必需）
- **组件名：** kebab-case
- **修饰符：** kebab-case
- **格式：** `theme-{component}-{modifier}`

### 4.2 标准类名列表

```css
/* 按钮 */
.user-theme .theme-button-primary { }
.user-theme .theme-button-secondary { }
.user-theme .theme-button-outline { }

/* 卡片 */
.user-theme .theme-card { }

/* 表单 */
.user-theme .theme-input { }
.user-theme .theme-textarea { }
.user-theme .theme-select { }

/* 徽章 */
.user-theme .theme-badge { }

/* 链接 */
.user-theme a { }
```

### 4.3 使用示例

```tsx
<button className="theme-button-primary">主要按钮</button>
<div className="theme-card">
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</div>
<input type="text" className="theme-input" placeholder="输入框" />
```

对应用户 CSS：

```css
:root {
  --color-primary: #ff4d4f;
  --color-surface: #1a1a2e;
  --color-border: rgba(255, 77, 79, 0.3);
}

.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
  transition: all 0.2s;
}

.user-theme .theme-button-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 77, 79, 0.4);
}
```

---

## 5. API 接口设计

### 5.1 用户信息接口

```
GET /api/user/info
```

```typescript
interface UserInfoResponse {
  userId: string
  userCSSUrl?: string
  userThemeVersion?: string
  userThemeHash?: string
  hasCustomTheme: boolean
}
```

### 5.2 CSS 提交接口

```
POST /api/user-theme
```

```typescript
// 请求
{ css: string, source: 'upload' | 'ai' }

// 响应
interface SubmitThemeResponse {
  success: boolean
  version: string
  hash: string
  cssUrl: string
  errors?: ValidationError[]
}
```

### 5.3 CSS 校验接口

```
POST /api/user-theme/validate
```

```typescript
// 请求
{ css: string }

// 响应
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

### 5.4 CSS 获取接口

```
GET /api/user-theme/{version}
```

返回 `Content-Type: text/css`，CSS 文本内容。

---

## 6. 技术栈

| 类别 | 技术/库 | 版本 | 用途 |
|------|---------|------|------|
| 框架 | Next.js | 14+ | SSR/CSR 混合渲染 |
| 路由 | App Router | 14+ | 推荐 |
| 语言 | TypeScript | 5.0+ | 类型安全 |
| CSS 解析 | postcss | ^8.4.0 | CSS AST 解析 |
| CSS 值解析 | postcss-value-parser | ^4.2.0 | CSS 值解析 |
| 缓存 | idb | ^8.0.0 | IndexedDB 封装 |
| 哈希 | crypto-js | ^4.2.0 | SHA-256 |
| 状态管理 | React Context | 18+ | 主题状态管理 |

**安装：**

```bash
npm install postcss postcss-value-parser idb crypto-js
npm install -D @types/crypto-js
```

### 项目结构

```
NextUserTheme/
├── app/
│   ├── layout.tsx               # SSR 用户 CSS 注入
│   ├── page.tsx
│   └── api/user-theme/
│       ├── route.ts             # 用户主题 API
│       └── validate/route.ts    # CSS 校验 API
├── components/
│   ├── ThemeProvider.tsx         # 客户端主题管理
│   └── ThemeSwitcher.tsx        # 主题切换 UI
├── lib/
│   ├── css-validator.ts         # CSS 校验模块
│   ├── css-cache.ts             # IndexedDB 缓存
│   ├── css-injector.ts          # Style 标签注入
│   ├── css-fetcher.ts           # CSS 获取工具
│   └── types.ts                 # TypeScript 类型定义
├── styles/
│   ├── globals.css              # 官方主题 CSS
│   └── variables.css            # CSS 变量定义
└── docs/
    ├── FEATURES.md              # 功能文档（本文件）
    └── PROGRESS.md              # 开发进度
```

---

## 7. 错误处理

| 错误类型 | 处理策略 | 用户提示 |
|---------|---------|---------|
| 网络错误 | 使用缓存版本，无缓存则使用官方主题 | "网络错误，使用缓存主题" |
| 校验失败 | 拒绝应用，使用官方主题 | "CSS 不符合安全规范" |
| 超时 | 使用缓存或官方主题 | "加载超时，使用默认主题" |
| IndexedDB 错误 | 降级到内存缓存或直接 fetch | "缓存不可用，使用在线版本" |

**SSR 错误处理：** CSS fetch 设置 3s 超时，失败/校验不通过则跳过用户 CSS，使用官方主题。

**CSR 错误处理：** ThemeProvider 中捕获异常，回退到官方主题或上一个可用版本。

---

## 8. 性能优化

### 8.1 首屏优化

- SSR 内联用户 CSS，避免 FOUC
- 官方 CSS 提取关键路径，优先加载
- CSS fetch 设置 3s 超时，避免阻塞 SSR

### 8.2 CSR 优化

- 从 DOM 提取 SSR 注入的 CSS，避免重复 fetch
- IndexedDB 操作异步，不阻塞 UI
- 主题切换防抖处理
- 可预加载常用版本到缓存

### 8.3 缓存优先级

```
首屏加载：SSR 注入 → IndexedDB → Network fetch
热切换：  IndexedDB → Network fetch
失效条件：Hash 不匹配 / 版本不存在 / TTL 过期
```

---

## 9. 大规模用户优化方案

### 9.1 多级缓存架构

```
用户请求 → CDN 边缘缓存 (L1, 命中率 80-90%)
         → Next.js SSR + Redis 缓存 (L2, 命中率 90-95%)
         → 数据库查询 (L3)
```

### 9.2 关键策略

- **CDN 分发**：用户 CSS 托管到 CDN，通过 hash 参数控制缓存失效
- **数据库优化**：索引优化、分表策略、读写分离
- **异步处理**：CSS 校验和存储异步化，快速响应
- **缓存预热**：定时预加载活跃用户 CSS 到 Redis
- **限流降级**：滑动窗口限流，超限使用默认主题

### 9.3 实施阶段

| 阶段 | 用户规模 | 关键措施 |
|------|---------|---------|
| 一 | 1-10 万 | Redis 缓存、SSR 超时降级、基础限流 |
| 二 | 10-100 万 | CDN 集成、缓存预热、监控告警 |
| 三 | 100 万+ | 数据库分片、读写分离、异步队列、多区域部署 |

### 9.4 性能目标

- 缓存命中率 > 95%
- CSS 加载延迟 P95 < 200ms
- SSR 响应时间 < 500ms
- 错误率 < 0.1%

---

## 10. 可视化编辑器设计（未来）

> 定位：**样式编辑器**，而非页面构建器。仅编辑样式属性，不修改 DOM 结构，不添加业务逻辑。

### 10.1 功能需求

1. **DOM 树选择器**：可视化 DOM 树，点击选择元素，高亮选中
2. **类名选择器**：按分类展示，支持搜索筛选
3. **属性编辑器**：颜色选择器、尺寸输入、边框/阴影配置
4. **实时预览**：左侧编辑，右侧预览，支持多设备
5. **样式管理**：保存预设，导入/导出，版本历史

### 10.2 界面布局（三栏式）

```
┌──────────┬──────────────┬─────────────┐
│ DOM 树    │   预览区域    │  属性编辑器  │
│ 面板 25%  │  (可交互) 50% │    25%      │
└──────────┴──────────────┴─────────────┘
```

### 10.3 DOM 树数据结构

```typescript
interface DOMNode {
  id: string
  type: 'element' | 'text' | 'component'
  tagName?: string
  componentName?: string
  className?: string[]
  children?: DOMNode[]
  themeClasses?: string[]    // 可主题化的类名
  selectable: boolean
  editable: boolean
}
```

### 10.4 编辑流程

```
页面加载 → 扫描 DOM，构建 DOM 树 → 用户点击元素 → 高亮对应元素
→ 显示属性编辑器 → 用户修改属性 → 实时预览 → 保存配置 → 生成 CSS
```

### 10.5 Tailwind CSS 支持

推荐使用 Tailwind 类名映射方案：将 Tailwind 类名转换为标准 CSS 属性，提供可视化选择器。

**限制：** 仅支持预定义类名，不支持动态值和响应式。

---

## 11. 类名管理系统（未来扩展）

### 11.1 数据库设计

```sql
CREATE TABLE theme_class_names (
  id VARCHAR(255) PRIMARY KEY,
  class_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  default_styles JSONB,
  editable_properties JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 11.2 API

- `GET /api/theme/class-names` — 获取所有类名列表
- `GET /api/theme/class-names/:id` — 获取单个类名详情
- `POST /api/theme/class-names` — 创建新类名（管理员）
- `PUT /api/theme/class-names/:id` — 更新类名配置（管理员）
- `DELETE /api/theme/class-names/:id` — 删除类名（管理员）

### 11.3 类名配置结构

```typescript
interface ThemeClassName {
  id: string
  className: string           // 'theme-button-primary'
  displayName: string         // '主要按钮'
  category: string            // 'button', 'card', 'form'
  description: string
  defaultStyles: { [property: string]: string }
  editableProperties: string[]
}
```

---

## 12. 开发最佳实践

1. **使用标准类名**：`theme-button-primary`，不要自定义前缀
2. **提供默认样式**：使用 CSS 变量并提供 fallback 值
3. **使用 CSS 变量**：`var(--color-primary, #6aa8ff)`，不要硬编码
4. **使用 !important**：确保用户 CSS 优先级覆盖
5. **添加过渡效果**：`transition: all 0.2s`
6. **支持 hover 状态**：提供交互反馈

---

## 13. 测试策略

### 单元测试

- CSS 校验模块：测试禁止规则、允许规则、边界情况
- 缓存模块：测试 IndexedDB CRUD 操作
- 注入模块：测试 style 标签创建/删除

### 集成测试

- ThemeProvider：缓存加载、主题切换、错误处理

### E2E 测试

- SSR 渲染用户主题（无 FOUC）
- 客户端热切换
- CSS 安全校验

---

## 14. 部署与监控

### 环境变量

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_THEME_API_ENDPOINT=/api/user-theme
THEME_CACHE_TTL=3600
THEME_FETCH_TIMEOUT=3000
```

### 监控指标

- CSS 加载成功率（SSR/CSR）
- 校验失败率
- 缓存命中率
- 主题切换延迟
- 错误类型分布

### 日志记录

- CSS 校验失败：错误类型 + 用户 ID
- 主题切换：版本 + 耗时
- 缓存操作：命中/未命中
- 网络错误：错误信息 + 重试次数

---

## 15. 方案可行性评估

### 可行性评分：4/5

**核心优势：**
- 首屏无 FOUC（SSR 内联 CSS）
- 热切换快速（IndexedDB 缓存）
- 安全可控（PostCSS AST 校验）
- 模块化设计，扩展性强
- 技术栈成熟（Next.js、PostCSS、IndexedDB）

**主要风险：**
- CSS 校验可能存在绕过边界情况（建议白名单模式）
- SSR 每次 fetch CSS 可能成为性能瓶颈（建议服务端缓存）
- IndexedDB 在隐私模式下可能受限（需降级方案）

**适用场景：** 中小型项目，需要高度自定义主题，对性能要求非极致。

**参考资源：**
- [CSS 变量文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [PostCSS 文档](https://postcss.org/)
- [Next.js 样式指南](https://nextjs.org/docs/app/building-your-application/styling)
