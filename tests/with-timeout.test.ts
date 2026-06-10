import { describe, expect, it } from "vitest";
import { withTimeout } from "@/lib/server/with-timeout";

const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe("withTimeout", () => {
  it("按时完成时返回原结果", async () => {
    await expect(withTimeout(delay(10, "ok"), 1000, "fallback")).resolves.toBe("ok");
  });

  it("超时返回 fallback", async () => {
    await expect(withTimeout(delay(500, "slow"), 20, "fallback")).resolves.toBe("fallback");
  });

  it("Promise 拒绝时返回 fallback 而不是抛出", async () => {
    const failing = Promise.reject(new Error("boom"));
    await expect(withTimeout(failing, 1000, null)).resolves.toBeNull();
  });

  it("fallback 支持 null 等任意值", async () => {
    await expect(withTimeout(delay(500, { a: 1 }), 20, null)).resolves.toBeNull();
  });
});
