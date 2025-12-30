# 用户自定义 CSS 主题系统 - 功能清单与进度

> 进度口径：**“可验收”**= 功能可跑通（SSR/CSR链路完整）、关键错误可观测（返回/日志）、核心安全规则生效。  
> Repo 当前是 demo 实现：服务端存储使用本地文件（非生产 DB/CDN），但接口形状、SSR/CSR 逻辑按 README 落地。

## 0. 里程碑

- [x] **M1：工程可运行**（Next.js 14+ App Router + TS，首页可打开）
- [x] **M2：安全校验可用**（PostCSS AST 校验，API 与 SSR/CSR 双端复用）
- [x] **M3：主题全链路**（提交→校验→存储→SSR 内联→CSR 提取缓存→热切换/回退）
- [x] **M4：多版本管理**（versions 列表、历史、IndexedDB 多版本缓存、currentVersion）

## 1. 功能清单（详细）

### 1.1 用户提交 CSS

- [x] **支持两种来源**：上传文件 / AI 生成文本（demo：文件上传在前端读取为文本再提交同一接口）  
  - 代码：`components/ThemeSwitcher.tsx`
- [ ] **提交接口**：`POST /api/user-theme`  
  - [x] 入参：`{ css: string; source: 'upload' | 'ai' }`
  - [x] 校验失败返回 `errors`
  - [x] 校验通过返回：`{ success, version, hash, cssUrl }`  
    - 代码：`app/api/user-theme/route.ts`
- [x] **版本标识**：`userId + hash` 或 `userThemeVersion`（demo：`{userId}-{hash.slice(0,12)}`）  
  - 代码：`lib/server/theme-store.ts`
- [x] **CSS 内容 hash**：SHA-256（返回给前端，并用于缓存一致性判断）  
  - 代码：`lib/css-hash.ts`, `lib/server/theme-store.ts`, `components/ThemeProvider.tsx`

### 1.2 CSS 安全校验（PostCSS AST）

- [x] **禁止选择器**：`body`, `html`, `*`, `html *`, `body *`（以及 README 扩展：`[style]`, `script`, `iframe`, `object`, `embed`）  
  - 代码：`lib/css-validator.ts`
- [x] **禁止 at-rule**：`@import`, `@font-face`, `@charset`, `@namespace`（README 还列了 `@keyframes/@media/@supports`，demo 默认也禁用）  
  - 代码：`lib/css-validator.ts`
- [ ] **禁止属性/值**：
  - [x] `position: fixed|sticky`
  - [x] `z-index > 1000`
  - [x] `content`（直接禁）
  - [x] `behavior`、`expression`（直接禁）
- [x] **（增强）禁止外部资源**：任意值中出现 `url(...)`（防止外链加载/隐私泄漏）  
  - 代码：`lib/css-validator.ts`
- [ ] **只允许的选择器模式**：
  - [x] `:root`（仅用于变量覆盖）
  - [x] `.user-theme ...`（作用域内选择器）
- [x] **输出错误结构**：`{ type, message, line?, column? }`  
  - 类型：`lib/types.ts`
  - 实现：`lib/css-validator.ts`

### 1.3 缓存策略（客户端 IndexedDB）

- [x] **存储介质**：IndexedDB（首选），失败降级内存缓存  
  - 代码：`lib/css-cache.ts`
- [ ] **记录结构**（对齐 README）：
  - [x] `UserCssRecord { version, css, hash, createdAt, userId? }`（类型：`lib/types.ts`）
- [ ] **API**：
  - [x] `getCss(version)`
  - [x] `setCss(record)`
  - [x] `getAllVersions()`
  - [x] `deleteCss(version)`
  - [x] `getCurrentVersion()`
  - [x] `setCurrentVersion(version)`

### 1.4 加载策略（SSR + CSR）

- [x] **官方 CSS**：固定加载，不可删除（`<link id="official-theme" ...>`）  
  - 代码：`app/layout.tsx`
- [ ] **SSR 首屏**（无 FOUC）：
  - [x] 服务端解析 userInfo（Cookie/Token）  
    - 代码：`app/layout.tsx`（cookie：`userId`，默认 `demo-user`）
  - [x] 拉取用户 CSS（通过 `userCSSUrl` 或内部服务）  
    - 代码：`lib/server/theme-store.ts` + `app/layout.tsx`
  - [x] 校验通过 → `<style id="user-theme-{version}">...</style>` 注入 `<head>`  
    - 代码：`app/layout.tsx`
  - [x] 失败/超时 → 降级为官方主题（不阻塞渲染）  
    - 代码：`app/layout.tsx`
  - [x] 超时：3s（可用 `THEME_FETCH_TIMEOUT` 覆盖）  
    - 代码：`app/layout.tsx`
- [ ] **CSR**：
  - [x] hydration 后检查 SSR style 标签，提取 CSS → 写入 IndexedDB  
    - 代码：`components/ThemeProvider.tsx`（`preferSsr` + `getSsrStyleCss` + `cssCache.setCss()`）
  - [x] SSR 未注入时：IndexedDB → network fetch → 校验 → 缓存 → 注入  
    - 代码：`components/ThemeProvider.tsx`（cache 优先，其次 fetch + `validateUserCss`）

### 1.5 热切换、多版本管理、回退

- [ ] **注入模块**：
  - [x] `injectStyle(id, css)`
  - [x] `updateStyle(id, css)`
  - [x] `removeStyle(id)`（保护 `official-theme`）
  - [x] `getStyleElement(id)`  
    - 代码：`lib/css-injector.ts`
- [ ] **ThemeProvider**（Context）：
  - [x] state：`currentVersion`, `availableVersions`, `isLoading`, `error`
  - [x] `switchTheme(version)`：优先 IDB，未命中才 fetch
  - [x] `revertToOfficial()`：删除所有用户 CSS style + 清空 currentVersion
  - [x] `refreshTheme()`：以 server 最新为准刷新
  - [x] `getThemeHistory()`：返回缓存中的 `UserCssRecord[]`  
    - 代码：`components/ThemeProvider.tsx`
- [ ] **切换行为**：
  - [x] 删除旧 `user-theme-{oldVersion}`
  - [x] 注入新 `user-theme-{newVersion}`
  - [x] 更新 `body`（或根节点）class：有用户主题时加 `.user-theme`  
    - 代码：`components/ThemeProvider.tsx`
- [ ] **版本列表来源**：
  - [x] 服务端 `/api/user-theme/versions`
  - [x] 客户端 IndexedDB（离线可用）  
    - 代码：`components/ThemeProvider.tsx`（server + local union）

### 1.6 API 形状（按 README + demo 必需补充）

- [x] `GET /api/user/info`：返回 `{ userId, hasCustomTheme, userCSSUrl?, userThemeVersion?, userThemeHash? }`  
  - 代码：`app/api/user/info/route.ts`
- [x] `POST /api/user-theme`：提交 CSS（保存并设为 current）  
  - 代码：`app/api/user-theme/route.ts`
- [x] `POST /api/user-theme/validate`：仅校验  
  - 代码：`app/api/user-theme/validate/route.ts`
- [x] `GET /api/user-theme/{version}`：返回 `text/css`  
  - 代码：`app/api/user-theme/[version]/route.ts`
- [x] `GET /api/user-theme/versions`：返回版本列表（demo 补充，用于 UI）  
  - 代码：`app/api/user-theme/versions/route.ts`

### 1.7 安全与部署相关（demo 做基础落地）

- [x] **style 注入安全**：防 `</style>` 提前闭合（最小必要转义）  
  - 代码：`app/layout.tsx`
- [x] **CSP Header**：至少包含 `style-src 'self' 'unsafe-inline'`（demo 在 `next.config` 配置响应头）  
  - 代码：`next.config.js`

### 1.8 UI（用于验收全链路）

- [x] 首页展示：当前版本、可用版本列表  
  - 代码：`app/page.tsx`, `components/ThemeSwitcher.tsx`
- [x] 主题切换：下拉/列表切换  
  - 代码：`components/ThemeSwitcher.tsx`
- [x] 回退官方主题按钮  
  - 代码：`components/ThemeSwitcher.tsx`
- [x] 提交 CSS：textarea + source 选择 + 提交  
  - 代码：`components/ThemeSwitcher.tsx`
- [x] 校验错误展示（逐条）  
  - 代码：`components/ThemeSwitcher.tsx`

## 2. 当前进度

- M1：已完成（`package.json`, `app/layout.tsx`, `app/page.tsx`, `public/official-theme.css`, `next.config.js`）
- M2：已完成（`lib/css-validator.ts` + API 校验接口）
- M3：已完成（提交→SSR→CSR缓存→热切换/回退链路打通）
- M4：已完成（versions 接口 + IndexedDB 多版本缓存 + currentVersion）

