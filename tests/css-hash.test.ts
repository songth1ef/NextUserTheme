import { describe, expect, it } from "vitest";
import { computeSha256Hex } from "@/lib/css-hash";

describe("computeSha256Hex", () => {
  it("与 SHA-256 标准测试向量一致", () => {
    expect(computeSha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(computeSha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("相同输入哈希稳定,不同输入哈希不同", () => {
    const a = computeSha256Hex(":root { --x: 1; }");
    expect(computeSha256Hex(":root { --x: 1; }")).toBe(a);
    expect(computeSha256Hex(":root { --x: 2; }")).not.toBe(a);
  });

  it("正确处理多字节 UTF-8 输入", () => {
    expect(computeSha256Hex("中文")).toMatch(/^[0-9a-f]{64}$/);
  });
});
