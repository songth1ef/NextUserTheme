# BACKLOG

> 优先级:P0 > P1 > P2。状态:`[ ]` 待办 / `[x]` 完成 / `[blocked]` 阻塞 / `[split]` 已拆分。
> 来源:2026-06-10 全仓扫描(README 限制章节、源码审查、协议初始化)。

## P0

- [x] **T1 建立测试基线** — 项目零测试,质量门无法运转。引入 vitest(devDependency,
  ADR 见 DECISIONS.md),为安全核心与纯函数补单测:`css-validator`(重点)、
  `sanitize`、`user-session`、`i18n-interpolate`、`css-hash`。验收:`npm test` 全绿,
  css-validator 覆盖正常/边界/绕过路径。
- [x] **T2 修复 css-validator 两处校验绕过** — ① `position: var(--p)` / `z-index: var(--z)`
  可借 `:root` 自定义属性绕过黑名单(`isForbiddenDecl` 只看首个 word token);
  ② `display: none` 守卫只匹配 selector 恰为 `:root`,`:root[data-color-mode="dark"]`
  上的 `display: none` 可整页隐藏。验收:新增绕过用例测试先红后绿。依赖 T1。

## P1

- [x] **T3 layout.tsx 主题获取缺超时保护** — README 声称"所有数据获取均设有超时保护",
  但 `getCurrentUserTheme` 只有 `.catch(() => null)`,无 `Promise.race` 超时,文件 I/O
  挂起会阻塞 SSR。验收:三路获取行为一致,超时降级为官方主题。
- [x] **T4 README API 文档漂移** — `POST /api/user-theme` 实际要求必填 `versionName`
  (缺失返回 400),README 示例没有;色彩模式默认值为 `dark` 未说明。验收:README 与
  实际 API 行为一致。
- [x] **T5 tsconfig.tsbuildinfo 误提交** — 构建产物已入库且不在 .gitignore。验收:
  加入 .gitignore 并从索引移除。

## P2

- [ ] **T6 manifest 并发写竞态** — theme-store / locale-store 对 manifest.json 的
  读-改-写无锁,并发请求会互相覆盖。demo 单用户影响小;生产需换 DB(见 KNOWN_ISSUES)。
  若做:进程内 per-user 串行队列。
- [ ] **T7 getUserThemeCss 兜底 record 伪造 createdAt** — record 文件缺失时用
  `Date.now()` 现造,应回退 manifest 里的真实条目。2026-06-10 评估:修复本身
  数行,但 theme-store 依赖 `process.cwd()/.data`,无法在不动模块结构的前提下
  补单测(质量门要求),留待与 T6 一起做 store 可测化改造时处理。
- [ ] **T8 ESLint 8 已 EOL** — 升级 ESLint 9 / eslint-config-next 需随 Next 升级联动,
  属依赖大版本变更,需人工拍板(见 KNOWN_ISSUES)。
