# KNOWN ISSUES

> 已知问题与暂缓事项。需要人工决策的条目标 `[需人工]`。

## 安全 / 架构(demo 定位下接受,生产化前必须解决)

- **鉴权是占位实现**:`lib/server/user-session.ts` 直接信任 cookie `userId` /
  Bearer token 原文,任何人可伪造任意 userId 读写他人主题。生产化需真实会话体系。
  不在本循环修(超出 demo 范围,且无既定鉴权方案可遵循)。
- **文件存储不支持多实例**:`.data/` 本地文件 + 进程内存缓存,横向扩容会数据分裂。
  README 已声明此限制。生产化需 DB + 共享缓存。
- **manifest 读-改-写无锁(T6)**:同一用户并发提交/删除/改色彩模式会互相覆盖
  manifest.json。单用户 demo 影响小,记入 BACKLOG P2。

## 工程

- `[需人工]` **ESLint 8.57 已 EOL**(npm install 出 deprecated 警告)。升级 ESLint 9
  需要 eslint-config-next 配套(随 Next 15 升级联动),属大版本依赖变更,等人工拍板。
- `.node-version` 声明 20,本机开发用 node 24 实测可用;CI/部署若严格按 20 跑,
  需确认 lockfile 在 20 下可安装。
- git 历史中 commit `36ada02` 的中文 message 是 mojibake(编码事故)。按红线不改
  git 历史,仅记录。

## 文档

- 根目录 `PROGRESS.md` 是历史功能验收清单(M1-M4),与 `docs/PROGRESS.md`(会话
  进度日志)职责不同,保留不动。
