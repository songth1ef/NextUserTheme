# DECISIONS (ADR)

> 格式:背景 → 选项 → 决定 → 理由。`[assumption]` 标记的条目是 agent 自主假设,待人工复核。

## 2026-06-10 ADR-001: 引入 vitest 作为测试框架

- **背景**:项目零测试,自主开发循环的质量门(测试不过=未完成)无法运转。协议允许
  BACKLOG 明确要求时引入新依赖(T1)。
- **选项**:① node:test(零依赖,但对 TS path alias `@/` 支持繁琐);② jest(重,
  ESM/TS 配置成本高);③ vitest(原生 ESM + TS,esbuild 转译,社区 Next.js 项目主流)。
- **决定**:vitest(devDependency),仅做纯函数/服务端模块单测,不引入 jsdom 组件测试。
- **理由**:配置最小(一个 vitest.config.ts 解决 alias),不碰运行时依赖,与
  `"type": "module"` 的 ESM 工程天然兼容。组件测试收益低(demo UI),暂不投入。

## 2026-06-10 ADR-002: [assumption] 本次会话所有任务在单一分支 auto/20260610-autoloop 上串行完成

- **背景**:协议要求"只在功能分支工作(如 auto/<task-id>)",但 T2 依赖 T1 的测试
  设施,逐任务开分支会产生链式依赖分支。
- **决定**:单会话分支 + 每任务独立 commit(`type(scope): 摘要 [task-id]`),整支可
  作为一个 PR 审查。
- **理由**:满足"不碰 main"红线,保留逐任务回退能力(per-commit revert),审查成本
  低于 N 个互相依赖的分支。

## 2026-06-10 ADR-003: [assumption] T2 校验绕过修复采用"受限属性禁用函数值"策略

- **背景**:`position` / `z-index` 黑名单只解析首个 word token,`var()` / `calc()` /
  `env()` 等函数值可携带任意最终值绕过(自定义属性在 `:root` 合法定义后被引用)。
- **选项**:① 追踪自定义属性求值(等于实现 CSS 级联,复杂且必然有洞);② 受限属性
  (`position` / `z-index`)直接禁止任何函数类值,只允许字面量;③ 全局禁 `var()`
  (过严,变量主题是核心场景)。
- **决定**:选项 ②。受限属性的值含 function 节点即报错;`display` 守卫从"selector
  恰为 :root"扩展为"所有 :root 变体(含属性选择器形式)"。
- **理由**:最小可逆,不影响 `:root { --var: value }` 主场景(限制只作用于黑名单
  属性的值);白名单思路与现有 validator 设计一致。
