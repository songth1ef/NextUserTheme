# PROJECT

> 自主开发循环的项目认知文件。人工修改后 agent 以此为准。

## 目标

Next.js 用户自定义主题系统 demo:用户提交自定义 CSS / 色彩模式 / 语言包,
SSR 首屏无闪烁(FOUC-free),客户端热切换,多版本管理,本地缓存。
定位是 **CSS 主题定制系统**,不是低代码搭建平台(用户只能改样式,不能改结构)。

## 范围与约束

- demo 级实现:服务端存储用本地文件系统 `.data/`(非生产 DB/CDN),单实例部署。
- 鉴权是占位实现:`userId` 直接取自 cookie / Bearer header,默认 `demo-user`。
- 安全核心是 `lib/css-validator.ts`(PostCSS AST 白名单校验),所有 CSS 注入路径
  (API 提交、SSR 注入、CSR fetch)都必须经过它。
- 不引入新框架/新依赖,除非 BACKLOG 明确要求并在 DECISIONS.md 记录理由。

## 技术栈

| 类别 | 技术 |
|------|------|
| Framework | Next.js 14 App Router(SSR + Route Handlers) |
| Language | TypeScript 5.7(strict) |
| CSS 校验 | postcss 8 + postcss-value-parser |
| 客户端缓存 | IndexedDB(idb 8) |
| 哈希 | crypto-js SHA-256 |
| 服务端存储 | 本地文件系统 `.data/user-themes/` `.data/user-locales/` |
| 测试 | vitest(2026-06-10 引入,见 DECISIONS.md) |

Node 版本:`.node-version` 声明 20;本机开发实测 node 24 可用。

## 模块结构

- `app/layout.tsx` — SSR 入口:并行取主题 CSS / 色彩模式 / 翻译,内联进 HTML
- `app/api/**` — Route Handlers(user-theme / color-mode / user-i18n / i18n / user/info)
- `lib/css-validator.ts` — CSS 安全校验(选择器白名单 + at-rule 黑名单 + 属性黑名单)
- `lib/server/theme-store.ts` — 主题存储(文件系统 + 内存 TTL 缓存,每用户上限 50 版本)
- `lib/server/locale-store.ts` — 语言包存储(同上模式)
- `lib/server/user-session.ts` — userId 提取(cookie > Bearer > demo-user)
- `lib/server/sanitize.ts` — 路径段消毒(防路径穿越)
- `components/*Provider.tsx` — Theme / ColorMode / I18n 三个 Context
- `locales/` — 内置语言包与 key 定义

## 构建与测试命令

```bash
npm run dev         # 开发服务器 http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run lint        # next lint (ESLint 8)
npm run build       # 生产构建
npm test            # vitest run(单元测试)
```

质量门:typecheck + lint + test 全绿才能标记任务完成。

## 相关文档

- 根目录 `PROGRESS.md` — 历史功能验收清单(M1-M4 里程碑,只读参考)
- `docs/BACKLOG.md` — 待办清单(P0/P1/P2)
- `docs/PROGRESS.md` — 会话进度日志
- `docs/DECISIONS.md` — ADR
- `docs/KNOWN_ISSUES.md` — 已知问题与暂缓事项
- `docs/fouc-free-architecture/` `docs/userCSS/` `docs/i18n/` — 既有设计文档
