import { describe, expect, it } from "vitest";
import { validateUserCss } from "@/lib/css-validator";

const valid = (css: string) => {
  const result = validateUserCss(css);
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
};

const invalid = (css: string, messagePart: string) => {
  const result = validateUserCss(css);
  expect(result.valid).toBe(false);
  expect(result.errors.map((e) => e.message).join("\n")).toContain(messagePart);
};

describe("validateUserCss 正常路径", () => {
  it("允许 :root 变量覆盖", () => {
    valid(":root { --color-primary: #ff4d4f; --radius: 8px; }");
  });

  it("允许 .user-theme 作用域选择器(含后代)", () => {
    valid(".user-theme .card { color: red; }\n.user-theme button { padding: 4px; }");
  });

  it("允许色彩模式属性选择器", () => {
    valid('html[data-color-mode="light"] { --bg: #fff; }');
    valid(':root[data-color-mode="dark"] { --bg: #000; }');
  });

  it("允许常规属性(position: relative / z-index <= 1000)", () => {
    valid(".user-theme .a { position: relative; z-index: 1000; }");
  });

  it("逗号分隔的多个合法选择器", () => {
    valid(":root, .user-theme .a { --x: 1px; }");
  });
});

describe("validateUserCss 选择器限制", () => {
  it.each(["body", "html", "*", "[style]", "script", "iframe", "object", "embed"])(
    "禁止危险选择器 %s",
    (selector) => {
      invalid(`${selector} { color: red; }`, "禁止全局/危险选择器");
    }
  );

  it("禁止白名单外的普通类选择器", () => {
    invalid(".other-class { color: red; }", "只允许");
  });

  it("逗号列表中混入非法选择器时整体报错", () => {
    invalid(":root, body { --x: 1; }", "禁止全局/危险选择器");
  });

  it("禁止 .user-theme 前缀伪装(.user-themed)", () => {
    invalid(".user-themed { color: red; }", "只允许");
  });
});

describe("validateUserCss at-rule 限制", () => {
  it.each([
    ["@import url('x.css');", "@import"],
    ["@font-face { font-family: a; }", "@font-face"],
    ["@media (min-width: 100px) { :root { --x: 1; } }", "@media"],
    ["@keyframes spin { from { opacity: 0; } }", "@keyframes"],
    ["@layer base { :root { --x: 1; } }", "@layer"],
    ["@supports (display: grid) { :root { --x: 1; } }", "@supports"]
  ])("禁止 %s", (css, name) => {
    invalid(css, `禁止使用 ${name}`);
  });
});

describe("validateUserCss 属性限制", () => {
  it("禁止 position: fixed / sticky", () => {
    invalid(".user-theme .a { position: fixed; }", "position: fixed");
    invalid(".user-theme .a { position: sticky; }", "position: sticky");
  });

  it("禁止 z-index > 1000", () => {
    invalid(".user-theme .a { z-index: 1001; }", "z-index > 1000");
  });

  it("禁止 content / behavior / expression", () => {
    invalid('.user-theme .a { content: "x"; }', "content");
    invalid(".user-theme .a { behavior: none; }", "behavior");
  });

  it("禁止任意位置的 url()", () => {
    invalid(".user-theme .a { background: url(https://evil.example/x.png); }", "url()");
    invalid(":root { --bg: url(data:image/png;base64,AAAA); }", "url()");
  });

  it("禁止 :root 上 display: none", () => {
    invalid(":root { display: none; }", "display: none");
  });
});

describe("validateUserCss 边界与错误路径", () => {
  it("空字符串与纯空白", () => {
    invalid("", "CSS 为空");
    invalid("   \n\t  ", "CSS 为空");
  });

  it("语法错误返回解析失败而不是抛异常", () => {
    const result = validateUserCss(":root { --x: ");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("错误对象带行列定位", () => {
    const result = validateUserCss("\n\nbody { color: red; }");
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.line).toBe(3);
  });

  it("多处违规逐条报告", () => {
    const result = validateUserCss("body { color: red; }\n@import 'x.css';");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
