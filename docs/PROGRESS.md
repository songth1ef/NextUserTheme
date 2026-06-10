# PROGRESS(会话进度日志)

> 自主开发循环的进度日志,按时间追加。根目录 `PROGRESS.md` 是历史功能验收清单,另一回事。

## [2026-06-10 23:30] 会话开始

- 基线状态:`npm run typecheck` ✓ / `npm run lint` ✓ / `npm run build` ✓(Next 14.2.35,
  14 路由全部生成)。**无任何测试**(无 test script、无测试文件)。
- 依赖:全新 `npm install`(332 packages),仅 deprecated 警告(ESLint 8 EOL 等),无 error。
- 本轮计划:初始化 docs 体系 → T1(测试基线)→ T2(validator 绕过修复)→ T3 / T4 / T5。
- 工作分支:`auto/20260610-autoloop`(ADR-002)。

## [2026-06-10 23:34] T1 建立测试基线 —— done

- 改动:vitest(devDep)+ vitest.config.ts(@ alias)+ package.json test script;
  tests/ 下 5 个测试文件 50 用例(css-validator 31、user-session 6、sanitize 5、
  i18n-interpolate 5、css-hash 3)。
- 测试:50/50 通过;typecheck / lint 绿。
- 文档:README 开发命令补 `npm test`;ADR-001 记录 vitest 选型。
- 提交:2b43b02
- 遗留:无组件/集成测试(demo UI,ADR-001 明确不投入)。

## [2026-06-10 23:37] T2 修复 css-validator 校验绕过 —— done

- 改动:lib/css-validator.ts —— ① position/z-index 禁止函数值(var()/calc() 可借
  :root 自定义属性携带 fixed/超限值绕过黑名单);② display:none 守卫从"恰为 :root"
  扩展到所有根级选择器变体(:root[...] / html[...]),并同样禁函数值。
- 测试:5 个绕过用例先红(4 失败确认漏洞)后绿;全量 55/55 通过。
- 文档:README 校验规则补两条;ADR-003 记录修复策略取舍。
- 提交:9bb24dd
- 遗留:无。

## [2026-06-10 23:43] T3 SSR 主题获取超时保护 —— done

- 改动:新增 lib/server/with-timeout.ts(超时/拒绝统一降级 fallback),
  app/layout.tsx 三路数据获取收敛到 withTimeout;顺带修复原 i18n/colorMode
  Promise.race 路径上 rejection 会让 SSR 直接 500 的问题。
- 测试:withTimeout 4 用例;全量 59/59 通过;typecheck / lint / build 全绿。
- 文档:README"所有数据获取均设有超时保护"的说法自此成立,无需改。
- 提交:c9565fd(注:tsconfig.tsbuildinfo 的删除因暂存顺序混入本提交,内容无误,
  按红线不改历史,记录在此)
- 遗留:无。

## [2026-06-10 23:45] T4 README API 文档漂移 —— done

- 改动:POST /api/user-theme 示例补必填 versionName;色彩模式默认值 dark 补充;
  提交示例代码同步。
- 测试:纯文档,质量门沿用 T3 全绿状态。
- 提交:13f331d

## [2026-06-10 23:45] T5 tsconfig.tsbuildinfo 移出版本控制 —— done

- 改动:.gitignore 追加;索引移除(实际删除落在 c9565fd,见 T3 备注)。
- 提交:6d07744

## [2026-06-10 23:50] 会话总结

- **完成 6 项**:docs 体系初始化 + T1 / T2 / T3 / T4 / T5(P0、P1 清空);
  blocked 0,拆分 0。
- **最终质量门**:test 59/59 ✓ / typecheck ✓ / lint ✓ / build ✓(均含 T1-T5 改动)。
- **本轮最有价值发现**:css-validator 存在真实可利用的校验绕过(var() 携带
  position:fixed / 整页 display:none),已修复并有回归测试钉死。
- **需人工决策(按紧急度)**:
  1. 审查并合并分支 `auto/20260610-autoloop`(7 个 commit,main 未动);
  2. T8:ESLint 8 已 EOL,升级需随 Next 15 联动,要不要排期;
  3. T6/T7:文件存储并发竞态与 store 可测化改造,demo 定位下可继续接受,
     生产化前必须处理(KNOWN_ISSUES 有完整记录)。
- **建议下一步**:合并后在 CI 挂上 `npm test + typecheck + lint` 作为门禁。
