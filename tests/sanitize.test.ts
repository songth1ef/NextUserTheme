import { describe, expect, it } from "vitest";
import { sanitizeSegment } from "@/lib/server/sanitize";

describe("sanitizeSegment", () => {
  it("保留字母数字、下划线和连字符", () => {
    expect(sanitizeSegment("demo-user_01")).toBe("demo-user_01");
  });

  it("路径穿越字符全部替换", () => {
    expect(sanitizeSegment("../../etc/passwd")).toBe("______etc_passwd");
    expect(sanitizeSegment("..\\..\\windows")).toBe("______windows");
  });

  it("路径分隔符与点号替换为下划线", () => {
    expect(sanitizeSegment("a/b.c")).toBe("a_b_c");
  });

  it("空字符串原样返回", () => {
    expect(sanitizeSegment("")).toBe("");
  });

  it("非 ASCII 字符替换为下划线", () => {
    expect(sanitizeSegment("用户1")).toBe("__1");
  });
});
