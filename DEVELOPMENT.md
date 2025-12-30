# 开发指南

## 0. 系统定位

### 0.1 核心定位

**本系统是：CSS 主题定制系统，而非低代码搭建平台**

**核心区别：**

| 特性 | 本系统（主题定制） | 低代码平台 |
|------|------------------|-----------|
| **主要功能** | 样式/主题定制 | 页面/应用搭建 |
| **操作对象** | 已有组件的样式 | 组件/页面结构 |
| **输出产物** | CSS 样式文件 | 完整页面/应用 |
| **开发方式** | 开发者编写组件代码 | 用户拖拽组件 |
| **用户能力** | 修改样式属性 | 创建页面结构 |
| **技术栈** | CSS + 主题变量 | 组件库 + 数据绑定 |

### 0.2 功能边界

**✅ 本系统支持：**
- 用户自定义 CSS 样式（颜色、尺寸、边框等）
- 覆盖官方主题的视觉样式
- 多版本主题管理和切换
- 可视化样式编辑器（未来）

**❌ 本系统不支持：**
- 创建新组件
- 修改页面结构（DOM 树）
- 添加业务逻辑
- 数据绑定和交互

### 0.3 与低代码平台的相似点

确实存在相似之处，但目的不同：

1. **DOM 树结构**
   - **本系统：** 用于选择元素，修改其样式
   - **低代码：** 用于构建页面结构

2. **可视化编辑器**
   - **本系统：** 编辑样式属性（颜色、大小等）
   - **低代码：** 编辑组件和布局

3. **配置化系统**
   - **本系统：** 配置 CSS 样式
   - **低代码：** 配置组件属性和数据源

### 0.4 系统演进路径

```
阶段 1：CSS 主题系统（当前）
  ↓
  用户提交 CSS → 校验 → 应用样式

阶段 2：可视化样式编辑器（未来）
  ↓
  DOM 树选择 → 属性编辑 → 生成 CSS → 应用样式

阶段 3：低代码平台（可选扩展）
  ↓
  组件库 → 拖拽布局 → 样式定制 → 数据绑定 → 生成应用
```

**当前定位：** 阶段 1-2，专注于样式定制，不涉及页面构建。

### 0.5 可视化编辑器的定位

**可视化编辑器在本系统中的作用：**

1. **降低 CSS 编写门槛**
   - 非技术用户可通过 UI 修改样式
   - 无需手写 CSS 代码
   - 实时预览效果

2. **保持系统边界**
   - 仅编辑样式属性（颜色、大小、边框等）
   - 不修改 DOM 结构
   - 不添加业务逻辑

3. **提升用户体验**
   - 所见即所得
   - 快速调整样式
   - 减少试错成本

**与低代码平台的可视化编辑器对比：**

| 功能 | 本系统编辑器 | 低代码编辑器 |
|------|------------|------------|
| **选择元素** | ✅ 选择已有元素 | ✅ 选择已有元素 |
| **修改样式** | ✅ 修改样式属性 | ✅ 修改样式属性 |
| **修改结构** | ❌ 不支持 | ✅ 支持（拖拽、删除、添加） |
| **添加组件** | ❌ 不支持 | ✅ 支持（从组件库拖入） |
| **数据绑定** | ❌ 不支持 | ✅ 支持（配置数据源） |
| **业务逻辑** | ❌ 不支持 | ✅ 支持（事件处理、条件渲染） |

**结论：** 本系统的可视化编辑器是"样式编辑器"，而非"页面构建器"。

## 1. CSS 开发规则

### 1.1 允许的选择器

**✅ 允许：**

```css
/* 1. :root 变量覆盖 */
:root {
  --color-primary: #ff4d4f;
  --color-surface: #1a1a2e;
  --color-border: rgba(255, 77, 79, 0.3);
}

/* 2. .user-theme 作用域选择器 */
.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
}

/* 3. .user-theme 后代选择器 */
.user-theme .theme-card {
  border-color: var(--color-border) !important;
}

/* 4. 伪类选择器 */
.user-theme .theme-button-primary:hover {
  transform: translateY(-1px);
}
```

### 1.2 禁止的选择器

**❌ 禁止：**

```css
/* 全局选择器 */
body { color: red; }          /* ❌ 禁止 */
html { margin: 0; }            /* ❌ 禁止 */
* { box-sizing: border-box; }  /* ❌ 禁止 */

/* 危险选择器 */
[style] { }                    /* ❌ 禁止 */
script { }                      /* ❌ 禁止 */
iframe { }                      /* ❌ 禁止 */
```

### 1.3 禁止的属性

**❌ 禁止：**

```css
/* 危险定位 */
.user-theme .element {
  position: fixed;    /* ❌ 禁止 */
  position: sticky;   /* ❌ 禁止 */
  z-index: 2000;      /* ❌ 禁止 (z-index > 1000) */
}

/* 外部资源 */
.user-theme .element {
  background: url('http://example.com/image.png');  /* ❌ 禁止 */
  @import 'external.css';                           /* ❌ 禁止 */
}

/* 其他危险属性 */
.user-theme .element {
  content: '...';     /* ❌ 禁止 */
  behavior: url(...); /* ❌ 禁止 */
  expression: ...;    /* ❌ 禁止 */
}
```

### 1.4 禁止的 At-Rule

**❌ 禁止：**

```css
@import 'external.css';     /* ❌ 禁止 */
@font-face { ... }          /* ❌ 禁止 */
@charset 'UTF-8';          /* ❌ 禁止 */
@namespace '...';          /* ❌ 禁止 */
@keyframes { ... }         /* ❌ 禁止 */
@media { ... }             /* ❌ 禁止 */
@supports { ... }          /* ❌ 禁止 */
```

## 2. 标准类名规范

### 2.1 类名命名规则

所有可主题化的类名必须遵循以下规范：

- **前缀：** `theme-`（必需）
- **组件名：** 使用 kebab-case（小写字母 + 连字符）
- **修饰符：** 使用 kebab-case

**格式：** `theme-{component}-{modifier}`

### 2.2 标准类名列表

#### 按钮类

```css
/* 主要按钮 */
.user-theme .theme-button-primary { }

/* 次要按钮 */
.user-theme .theme-button-secondary { }

/* 轮廓按钮 */
.user-theme .theme-button-outline { }
```

#### 卡片类

```css
/* 基础卡片 */
.user-theme .theme-card { }
```

#### 表单类

```css
/* 输入框 */
.user-theme .theme-input { }

/* 文本域 */
.user-theme .theme-textarea { }

/* 下拉选择 */
.user-theme .theme-select { }
```

#### 徽章类

```css
/* 基础徽章 */
.user-theme .theme-badge { }
```

#### 链接类

```css
/* 链接（使用 a 标签，无需类名） */
.user-theme a { }
```

### 2.3 使用示例

**HTML 结构：**

```tsx
<button className="theme-button-primary">
  主要按钮
</button>

<div className="theme-card">
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</div>

<input type="text" className="theme-input" placeholder="输入框" />
```

**CSS 样式：**

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

.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
  transition: all 0.2s;
}

.user-theme .theme-card:hover {
  border-color: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.1);
}
```

## 3. 类名管理系统（未来扩展）

### 3.1 数据库设计

**表结构：`theme_class_names`**

```sql
CREATE TABLE theme_class_names (
  id VARCHAR(255) PRIMARY KEY,
  class_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- 'button', 'card', 'form', 'badge', etc.
  description TEXT,
  default_styles JSONB,            -- 默认样式配置
  editable_properties JSONB,        -- 可编辑的属性列表
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 示例数据
INSERT INTO theme_class_names (id, class_name, display_name, category, description, editable_properties) VALUES
('btn-primary', 'theme-button-primary', '主要按钮', 'button', '主要操作按钮', 
 '["background", "color", "border", "borderRadius", "padding", "fontSize", "boxShadow"]'),
('card', 'theme-card', '卡片', 'card', '内容卡片容器', 
 '["background", "border", "borderRadius", "padding", "boxShadow"]'),
('input', 'theme-input', '输入框', 'form', '文本输入框', 
 '["background", "border", "borderColor", "borderRadius", "padding", "fontSize"]');
```

### 3.2 API 接口

#### GET /api/theme/class-names

获取所有类名列表

**Response:**
```json
{
  "classNames": [
    {
      "id": "btn-primary",
      "className": "theme-button-primary",
      "displayName": "主要按钮",
      "category": "button",
      "description": "主要操作按钮",
      "editableProperties": ["background", "color", "border", "borderRadius"]
    }
  ]
}
```

#### GET /api/theme/class-names/:id

获取单个类名详情

#### POST /api/theme/class-names

创建新类名（管理员）

#### PUT /api/theme/class-names/:id

更新类名配置（管理员）

#### DELETE /api/theme/class-names/:id

删除类名（管理员）

### 3.3 类名配置结构

```typescript
interface ThemeClassName {
  id: string
  className: string           // CSS 类名，如 'theme-button-primary'
  displayName: string          // 显示名称，如 '主要按钮'
  category: string             // 分类，如 'button', 'card', 'form'
  description: string          // 描述
  defaultStyles: {             // 默认样式
    [property: string]: string
  }
  editableProperties: string[] // 可编辑的属性列表
  createdAt: number
  updatedAt: number
}

interface EditableProperty {
  name: string                 // 属性名，如 'background'
  type: 'color' | 'size' | 'text' | 'number' | 'select'
  label: string                // 显示标签
  defaultValue?: string
  options?: string[]           // select 类型的选项
  min?: number                 // number 类型的最小值
  max?: number                 // number 类型的最大值
}
```

## 4. 开发工作流程

### 4.1 标准流程（当前）

```
1. 设计组件
   ↓
2. 在代码中使用标准类名（如 theme-button-primary）
   ↓
3. 用户提交 CSS，覆盖这些类名的样式
   ↓
4. CSS 校验通过后保存到 userTheme
```

### 4.2 扩展流程（未来：可视化编辑器）

```
1. 管理员在数据库中创建类名配置
   ├─ 定义类名（theme-button-primary）
   ├─ 设置可编辑属性（background, color, border 等）
   └─ 配置默认样式
   ↓
2. 开发人员使用已注册的类名开发组件
   ├─ 查询类名列表 API
   ├─ 在代码中使用标准类名
   └─ 确保类名已在数据库中注册
   ↓
3. 用户通过可视化编辑器配置样式
   ├─ 选择类名（如 theme-button-primary）
   ├─ 可视化编辑属性（颜色选择器、滑块等）
   └─ 实时预览效果
   ↓
4. 生成 CSS 并保存
   ├─ 将配置转换为 CSS
   ├─ CSS 校验
   └─ 保存到 userTheme
```

## 5. 可视化编辑器设计

### 5.1 功能需求

1. **DOM 树结构选择器**
   - 可视化 DOM 树（类似浏览器 DevTools）
   - 支持点击选择元素
   - 显示元素层级关系
   - 高亮当前选中元素

2. **类名选择器**
   - 按分类展示（按钮、卡片、表单等）
   - 显示类名和描述
   - 支持搜索和筛选
   - 快速应用到选中元素

3. **属性编辑器**
   - 颜色选择器（color, background）
   - 尺寸输入（padding, margin, fontSize）
   - 边框配置（border, borderRadius）
   - 阴影配置（boxShadow）
   - 过渡动画（transition）
   - 支持 Tailwind CSS 类名

4. **实时预览**
   - 左侧编辑，右侧预览
   - 支持多设备预览（桌面、平板、手机）
   - 实时更新样式

5. **样式管理**
   - 保存为预设
   - 导入/导出配置
   - 版本历史

### 5.2 DOM 树结构设计

**是否需要 DOM 树 JSON 结构？** ✅ **需要**

可视化编辑器需要一个 DOM 树结构来：
- 展示页面元素层级
- 支持点击选择元素
- 显示元素信息（标签、类名、ID）
- 支持拖拽调整顺序（可选）

**DOM 树 JSON 结构：**

```typescript
interface DOMNode {
  id: string                    // 唯一标识
  type: 'element' | 'text' | 'component'
  tagName?: string              // 'div', 'button', 'input' 等
  componentName?: string        // React 组件名（如 'ThemeButton'）
  textContent?: string          // 文本节点内容
  className?: string[]          // 类名数组
  attributes?: {                // 其他属性
    [key: string]: string
  }
  children?: DOMNode[]          // 子节点
  styles?: {                   // 内联样式（用于预览）
    [property: string]: string
  }
  themeClasses?: string[]       // 可主题化的类名
  selectable: boolean           // 是否可选择
  editable: boolean             // 是否可编辑
}

interface DOMTree {
  root: DOMNode                 // 根节点
  selectedNodeId: string | null // 当前选中的节点 ID
  expandedNodes: string[]       // 展开的节点 ID 列表
}
```

**示例 DOM 树：**

```json
{
  "root": {
    "id": "root",
    "type": "element",
    "tagName": "div",
    "className": ["user-theme"],
    "children": [
      {
        "id": "btn-1",
        "type": "element",
        "tagName": "button",
        "componentName": "ThemeButton",
        "className": ["theme-button-primary"],
        "textContent": "主要按钮",
        "themeClasses": ["theme-button-primary"],
        "selectable": true,
        "editable": true,
        "children": []
      },
      {
        "id": "card-1",
        "type": "element",
        "tagName": "div",
        "className": ["theme-card"],
        "themeClasses": ["theme-card"],
        "selectable": true,
        "editable": true,
        "children": [
          {
            "id": "card-title",
            "type": "element",
            "tagName": "h3",
            "textContent": "卡片标题",
            "selectable": false,
            "editable": false,
            "children": []
          }
        ]
      }
    ],
    "selectable": false,
    "editable": false
  },
  "selectedNodeId": "btn-1",
  "expandedNodes": ["root", "card-1"]
}
```

### 5.3 元素选择与编辑流程

**工作流程：**

```
1. 页面加载
   ↓
2. 扫描 DOM，构建 DOM 树 JSON
   ├─ 识别可主题化的类名（theme-*）
   ├─ 提取元素信息（标签、类名、属性）
   └─ 标记可编辑元素
   ↓
3. 用户点击 DOM 树中的元素
   ↓
4. 高亮对应页面元素
   ↓
5. 显示该元素的属性编辑器
   ├─ 显示当前类名
   ├─ 显示可编辑属性
   └─ 显示当前样式值
   ↓
6. 用户修改属性
   ↓
7. 实时预览更新
   ↓
8. 保存到配置
```

**元素选择器 UI 设计：**

```
┌─────────────────────────────────────────┐
│  可视化编辑器                              │
├──────────────┬──────────────────────────┤
│ DOM 树面板    │  预览区域                 │
│              │                          │
│ ▼ <div>      │  [主要按钮] ← 高亮选中    │
│   ▼ <button> │  [卡片]                   │
│     "按钮"   │    - 标题                 │
│   ▼ <div>    │    - 内容                 │
│     ▼ <h3>   │                          │
│       "标题" │                          │
│              │                          │
├──────────────┤                          │
│ 属性编辑器    │                          │
│              │                          │
│ 选中: button  │                          │
│ 类名: theme- │                          │
│   button-    │                          │
│   primary    │                          │
│              │                          │
│ [颜色] [背景] │                          │
│ [边框] [圆角] │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

### 5.4 数据结构（增强版）

```typescript
interface ThemeStyleConfig {
  nodeId: string                // DOM 节点 ID
  className: string              // 'theme-button-primary'
  properties: {
    [property: string]: string   // { background: '#ff4d4f', color: '#fff' }
  }
  tailwindClasses?: string[]    // Tailwind CSS 类名（如 'bg-red-500'）
}

interface UserThemeConfig {
  userId: string
  version: string
  cssVariables: {                // :root 变量
    [varName: string]: string
  }
  classStyles: ThemeStyleConfig[] // 类名样式配置
  domTree?: DOMTree              // DOM 树结构（可选，用于可视化）
  createdAt: number
  updatedAt: number
}
```

### 5.5 Tailwind CSS 支持

**是否支持 Tailwind CSS？** ✅ **支持，但有限制**

#### 方案 1：Tailwind 类名映射（推荐）

将 Tailwind 类名转换为标准 CSS 属性：

```typescript
interface TailwindMapping {
  'bg-red-500': { background: '#ef4444' }
  'text-white': { color: '#ffffff' }
  'p-4': { padding: '1rem' }
  'rounded-lg': { borderRadius: '0.5rem' }
}

function tailwindToCSS(tailwindClass: string): { [property: string]: string } | null {
  const mapping: TailwindMapping = {
    'bg-red-500': { background: '#ef4444' },
    'text-white': { color: '#ffffff' },
    'p-4': { padding: '1rem' },
    'rounded-lg': { borderRadius: '0.5rem' },
    // ... 更多映射
  }
  return mapping[tailwindClass] || null
}
```

**限制：**
- 仅支持预定义的 Tailwind 类名
- 不支持动态值（如 `p-[20px]`）
- 不支持响应式（如 `md:p-4`）

#### 方案 2：Tailwind 类名直接使用（不推荐）

允许用户直接输入 Tailwind 类名，但需要：
- 在服务端编译 Tailwind
- 增加系统复杂度
- 可能影响性能

**推荐方案：** 使用方案 1，提供常用 Tailwind 类名的可视化选择器。

### 5.6 用户体验优化

#### 5.6.1 降低上手难度

1. **引导式界面**
   ```
   首次使用 → 显示引导提示
   ├─ "点击左侧元素选择要编辑的组件"
   ├─ "在右侧修改颜色、大小等属性"
   └─ "实时预览效果"
   ```

2. **预设模板**
   - 提供常用主题模板（深色、浅色、彩色等）
   - 一键应用模板
   - 基于模板微调

3. **智能提示**
   - 属性值自动补全
   - 颜色建议（基于当前主题色）
   - 尺寸建议（基于设计系统）

4. **拖拽式操作**
   - 拖拽调整元素顺序（可选）
   - 拖拽调整尺寸（可选，需谨慎）

#### 5.6.2 在线设计体验

**界面布局（三栏式）：**

```
┌──────────┬──────────────┬─────────────┐
│          │              │             │
│ DOM 树   │   预览区域    │  属性编辑器  │
│ 面板     │  (可交互)     │             │
│          │              │             │
│ 25%      │     50%      │    25%      │
└──────────┴──────────────┴─────────────┘
```

**交互优化：**

1. **点击选择**
   - 点击 DOM 树 → 高亮预览区域元素
   - 点击预览区域元素 → 选中 DOM 树对应节点

2. **实时反馈**
   - 鼠标悬停 → 显示元素信息
   - 选中元素 → 显示边框高亮
   - 修改属性 → 实时更新预览

3. **快捷操作**
   - `Ctrl/Cmd + Z` 撤销
   - `Ctrl/Cmd + Y` 重做
   - `Ctrl/Cmd + S` 保存
   - `Esc` 取消选择

### 5.7 CSS 生成逻辑（增强版）

```typescript
function generateCSS(config: UserThemeConfig): string {
  let css = ''
  
  // 1. 生成 :root 变量
  if (Object.keys(config.cssVariables).length > 0) {
    css += ':root {\n'
    for (const [key, value] of Object.entries(config.cssVariables)) {
      css += `  ${key}: ${value};\n`
    }
    css += '}\n\n'
  }
  
  // 2. 生成类名样式
  for (const classStyle of config.classStyles) {
    css += `.user-theme .${classStyle.className} {\n`
    
    // 2.1 标准 CSS 属性
    for (const [property, value] of Object.entries(classStyle.properties)) {
      css += `  ${property}: ${value};\n`
    }
    
    // 2.2 Tailwind 类名转换（如果使用）
    if (classStyle.tailwindClasses) {
      for (const twClass of classStyle.tailwindClasses) {
        const cssProps = tailwindToCSS(twClass)
        if (cssProps) {
          for (const [property, value] of Object.entries(cssProps)) {
            css += `  ${property}: ${value};\n`
          }
        }
      }
    }
    
    css += '}\n\n'
  }
  
  return css
}
```

### 5.8 DOM 树构建逻辑

```typescript
function buildDOMTree(rootElement: HTMLElement): DOMNode {
  const node: DOMNode = {
    id: generateId(),
    type: 'element',
    tagName: rootElement.tagName.toLowerCase(),
    className: Array.from(rootElement.classList),
    attributes: extractAttributes(rootElement),
    children: [],
    themeClasses: extractThemeClasses(rootElement),
    selectable: hasThemeClass(rootElement),
    editable: hasThemeClass(rootElement)
  }
  
  // 递归处理子节点
  for (const child of Array.from(rootElement.children)) {
    if (child instanceof HTMLElement) {
      node.children?.push(buildDOMTree(child))
    }
  }
  
  // 处理文本节点
  const textNodes = Array.from(rootElement.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
  if (textNodes.length > 0) {
    const textNode: DOMNode = {
      id: generateId(),
      type: 'text',
      textContent: textNodes.map(n => n.textContent).join(' ').trim() || undefined,
      selectable: false,
      editable: false
    }
    node.children?.push(textNode)
  }
  
  return node
}

function extractThemeClasses(element: HTMLElement): string[] {
  return Array.from(element.classList)
    .filter(className => className.startsWith('theme-'))
}

function hasThemeClass(element: HTMLElement): boolean {
  return extractThemeClasses(element).length > 0
}
```

### 5.9 完整编辑器架构

```typescript
interface ThemeEditorState {
  domTree: DOMTree
  selectedNodeId: string | null
  editingMode: 'class' | 'property' | 'tailwind'
  currentStyles: {
    [nodeId: string]: ThemeStyleConfig
  }
  history: ThemeEditorState[]  // 撤销/重做
  historyIndex: number
}

class ThemeEditor {
  private state: ThemeEditorState
  
  // 选择元素
  selectNode(nodeId: string): void {
    this.state.selectedNodeId = nodeId
    this.highlightElement(nodeId)
    this.showPropertyEditor(nodeId)
  }
  
  // 更新属性
  updateProperty(nodeId: string, property: string, value: string): void {
    const config = this.state.currentStyles[nodeId] || {
      nodeId,
      className: this.getNodeClassName(nodeId),
      properties: {}
    }
    config.properties[property] = value
    this.state.currentStyles[nodeId] = config
    this.applyStyles(nodeId)
    this.saveToHistory()
  }
  
  // 应用 Tailwind 类名
  applyTailwindClass(nodeId: string, tailwindClass: string): void {
    const cssProps = tailwindToCSS(tailwindClass)
    if (!cssProps) return
    
    const config = this.state.currentStyles[nodeId] || {
      nodeId,
      className: this.getNodeClassName(nodeId),
      properties: {},
      tailwindClasses: []
    }
    
    if (!config.tailwindClasses) {
      config.tailwindClasses = []
    }
    config.tailwindClasses.push(tailwindClass)
    
    // 将 Tailwind 转换为 CSS 属性
    Object.assign(config.properties, cssProps)
    
    this.state.currentStyles[nodeId] = config
    this.applyStyles(nodeId)
    this.saveToHistory()
  }
  
  // 生成最终 CSS
  generateCSS(): string {
    const config: UserThemeConfig = {
      userId: this.userId,
      version: generateVersion(),
      cssVariables: this.extractCSSVariables(),
      classStyles: Object.values(this.state.currentStyles),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    return generateCSS(config)
  }
}
```

## 6. 开发最佳实践

### 6.1 组件开发

1. **使用标准类名**
   ```tsx
   // ✅ 正确
   <button className="theme-button-primary">按钮</button>
   
   // ❌ 错误
   <button className="my-button">按钮</button>
   ```

2. **提供默认样式**
   ```tsx
   <button
     className="theme-button-primary"
     style={{
       padding: "10px 20px",
       borderRadius: "var(--radius, 8px)",
       background: "var(--color-primary, #6aa8ff)",
       // 使用 CSS 变量，用户可以通过 :root 覆盖
     }}
   >
     按钮
   </button>
   ```

3. **使用 CSS 变量**
   ```tsx
   // ✅ 推荐：使用 CSS 变量
   style={{ color: "var(--color-primary, #6aa8ff)" }}
   
   // ⚠️ 不推荐：硬编码颜色
   style={{ color: "#6aa8ff" }}
   ```

### 6.2 CSS 编写

1. **使用 !important 确保优先级**
   ```css
   .user-theme .theme-button-primary {
     background: var(--color-primary) !important;
   }
   ```

2. **添加过渡效果**
   ```css
   .user-theme .theme-button-primary {
     transition: all 0.2s;
   }
   ```

3. **支持 hover 状态**
   ```css
   .user-theme .theme-button-primary:hover {
     transform: translateY(-1px);
     box-shadow: 0 6px 16px rgba(255, 77, 79, 0.4);
   }
   ```

### 6.3 类名注册

**在开发新组件前：**

1. 检查类名是否已存在
   ```typescript
   const classNames = await fetch('/api/theme/class-names')
   const exists = classNames.find(cn => cn.className === 'theme-my-component')
   ```

2. 如果不存在，先注册类名（管理员操作）
   ```typescript
   await fetch('/api/theme/class-names', {
     method: 'POST',
     body: JSON.stringify({
       className: 'theme-my-component',
       displayName: '我的组件',
       category: 'custom',
       editableProperties: ['background', 'color', 'padding']
     })
   })
   ```

3. 然后在代码中使用
   ```tsx
   <div className="theme-my-component">...</div>
   ```

## 7. 完整示例

### 7.1 开发新按钮组件

**步骤 1：注册类名（管理员）**

```typescript
POST /api/theme/class-names
{
  "className": "theme-button-success",
  "displayName": "成功按钮",
  "category": "button",
  "description": "用于成功操作的按钮",
  "editableProperties": [
    "background",
    "color",
    "border",
    "borderRadius",
    "padding",
    "fontSize",
    "boxShadow"
  ]
}
```

**步骤 2：开发组件**

```tsx
// components/SuccessButton.tsx
export function SuccessButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="theme-button-success"
      style={{
        padding: "10px 20px",
        borderRadius: "var(--radius, 8px)",
        background: "var(--color-success, #10b981)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      {children}
    </button>
  )
}
```

**步骤 3：用户自定义样式**

```css
:root {
  --color-success: #10b981;
}

.user-theme .theme-button-success {
  background: var(--color-success) !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.user-theme .theme-button-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}
```

## 8. 未来扩展功能清单

### 8.1 类名管理系统

- [ ] 类名 CRUD API
- [ ] 类名管理后台界面
- [ ] 类名使用情况统计
- [ ] 类名文档自动生成

### 8.2 可视化样式编辑器（非低代码）

- [ ] DOM 树选择器（选择元素，不修改结构）
- [ ] 实时样式预览
- [ ] 颜色选择器组件
- [ ] 尺寸调整滑块
- [ ] 预设样式库
- [ ] 样式导入/导出

**注意：** 编辑器仅用于修改样式，不涉及页面结构构建。

### 8.3 样式配置系统

- [ ] 样式配置数据结构
- [ ] 配置到 CSS 的转换器
- [ ] 配置版本管理
- [ ] 配置分享功能

### 8.4 开发工具

- [ ] VS Code 扩展（类名自动补全）
- [ ] 类名使用检查工具
- [ ] 样式冲突检测
- [ ] 性能分析工具

### 8.5 低代码平台扩展（可选，独立模块）

如果未来需要扩展为低代码平台，需要：

- [ ] 组件库系统（可拖拽的组件）
- [ ] 页面结构编辑器（修改 DOM 树）
- [ ] 数据绑定系统
- [ ] 业务逻辑配置
- [ ] 页面路由管理

**建议：** 低代码功能应作为独立模块开发，与主题系统解耦。

## 9. 注意事项

### 9.1 性能考虑

- 避免过度使用 `!important`
- 合理使用 CSS 变量，避免深层嵌套
- 限制 CSS 文件大小（当前限制 200KB）

### 9.2 兼容性

- 确保所有类名在主流浏览器中正常工作
- 避免使用实验性 CSS 特性
- 提供降级方案

### 9.3 安全性

- 所有用户 CSS 必须通过校验
- 禁止外部资源加载
- 定期审查和更新校验规则

## 10. 参考资源

- [CSS 变量文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [PostCSS 文档](https://postcss.org/)
- [Next.js 样式指南](https://nextjs.org/docs/app/building-your-application/styling)

