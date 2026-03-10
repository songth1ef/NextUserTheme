# i18n 多语言系统

## 实现状态：已完成

自建轻量 i18n 方案（不使用 `next-intl`、不使用 `[locale]` 路由），完全复用 ThemeProvider / css-cache / theme-store 的模式。

---

## 架构概览

### 核心思路

与用户自定义主题相同的模式：**用户提交并维护自己的语言包**。

```
系统定义 key（翻译项）→ 用户上传/编辑 value（翻译内容）→ 系统加载用户语言包
```

- 系统提供**预置语言包**（中文 `locales/zh-CN.json`），保证开箱即用
- 用户可以创建自己的语言包，覆盖预置内容
- 缺失的 key 自动回退到预置语言包
- 语言包 ID 存储于服务端 manifest，通过 Cookie userId 关联

### 回退机制

```
t('key') 查找顺序：
  1. 用户当前语言包中查找 → 找到则使用
  2. 回退到系统预置语言包 → 找到则使用
  3. 都没有 → 显示 key 本身（兜底）
```

---

## 文件清单

### 新建文件（15 个）

| 文件 | 说明 |
|------|------|
| `locales/zh-CN.json` | 预置中文语言包（~80 个 key） |
| `locales/keys.ts` | Key 注册表（key + description + category） |
| `lib/i18n-types.ts` | TypeScript 类型定义 |
| `lib/i18n-interpolate.ts` | `{variable}` 插值函数 |
| `lib/i18n-cache.ts` | IndexedDB 缓存（镜像 `css-cache.ts`） |
| `lib/server/locale-store.ts` | 文件存储 CRUD（镜像 `theme-store.ts`） |
| `components/I18nProvider.tsx` | Context Provider（镜像 `ThemeProvider.tsx`） |
| `components/PageHeader.tsx` | 页面标题客户端组件（使用 `t()`） |
| `components/LocaleSwitcher.tsx` | 语言切换下拉组件 |
| `components/LocaleManager.tsx` | 语言包管理界面 |
| `app/api/i18n/keys/route.ts` | GET Key 注册表 |
| `app/api/i18n/builtin/route.ts` | GET 预置语言包 |
| `app/api/user-i18n/packs/route.ts` | GET 列表 / POST 创建 |
| `app/api/user-i18n/packs/[packId]/route.ts` | GET / PUT / DELETE 单个包 |
| `app/api/user-i18n/active/route.ts` | GET / PUT 当前语言包 |

### 修改文件（4 个）

| 文件 | 改动 |
|------|------|
| `app/layout.tsx` | 并行加载 theme + i18n → I18nProvider 包裹 ThemeProvider |
| `app/page.tsx` | 提取 PageHeader + 添加 LocaleSwitcher / LocaleManager |
| `components/ThemeSwitcher.tsx` | 所有中文 → `t()` 调用 |
| `components/ThemePreview.tsx` | 所有中文 → `t()` 调用 |

---

## 关键设计

### SSR 无闪烁

`layout.tsx` 服务端完成翻译合并 → `I18nProvider` 接收 `initialTranslations` → SSR 渲染已翻译文本 → hydration 匹配。

### 热切换无刷新

`switchPack()` 更新 React state（translations map）→ 所有使用 `t()` 的组件自动重渲染。

### 服务端存储结构

```
.data/user-locales/{userId}/
├── manifest.json          # { activePackId, packs: [{id, name, ...}] }
├── {packId}.json          # UserLocalePack 完整数据
└── ...
```

### 插值语法

```tsx
t('message.count', { count: 5 })  // → "你有 5 条消息"
```

用户翻译时保留 `{变量名}` 即可。管理界面对含变量的 key 显示提示。

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/i18n/keys` | Key 注册表 |
| GET | `/api/i18n/builtin` | 预置语言包 |
| GET | `/api/user-i18n/packs` | 用户语言包列表 |
| POST | `/api/user-i18n/packs` | 创建语言包 |
| GET | `/api/user-i18n/packs/:id` | 获取单个包 |
| PUT | `/api/user-i18n/packs/:id` | 更新语言包 |
| DELETE | `/api/user-i18n/packs/:id` | 删除语言包 |
| GET | `/api/user-i18n/active` | 获取当前活跃包 + 合并翻译 |
| PUT | `/api/user-i18n/active` | 切换语言包 |

---

## 使用方法

### 组件中使用翻译

```tsx
import { useI18n } from "@/components/I18nProvider";

function MyComponent() {
  const { t } = useI18n();
  return <h1>{t("page.title")}</h1>;
}
```

### 添加新的 i18n key

1. 在 `locales/zh-CN.json` 添加中文值
2. 在 `locales/keys.ts` 添加 key 定义（含 description 和 category）
3. 在组件中使用 `t("your.key")`
