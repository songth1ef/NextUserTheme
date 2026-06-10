import { describe, expect, it } from "vitest";
import { interpolate } from "@/lib/i18n-interpolate";

describe("interpolate", () => {
  it("替换单个与多个占位符", () => {
    expect(interpolate("你好,{name}", { name: "用户" })).toBe("你好,用户");
    expect(interpolate("{a} + {b}", { a: 1, b: 2 })).toBe("1 + 2");
  });

  it("无 params 时原样返回", () => {
    expect(interpolate("你好,{name}")).toBe("你好,{name}");
  });

  it("缺失的 key 保留占位符", () => {
    expect(interpolate("{x} {y}", { x: "a" })).toBe("a {y}");
  });

  it("数字 0 也能正确替换", () => {
    expect(interpolate("count={n}", { n: 0 })).toBe("count=0");
  });

  it("同一占位符出现多次全部替换", () => {
    expect(interpolate("{n}{n}", { n: "x" })).toBe("xx");
  });
});
