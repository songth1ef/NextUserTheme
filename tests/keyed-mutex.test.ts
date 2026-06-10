import { describe, expect, it } from "vitest";
import { withKeyLock } from "@/lib/server/keyed-mutex";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("withKeyLock", () => {
  it("同 key 操作严格串行(慢任务先进队也先完成)", async () => {
    const order: string[] = [];
    const slow = withKeyLock("k", async () => {
      await delay(30);
      order.push("slow");
    });
    const fast = withKeyLock("k", async () => {
      order.push("fast");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["slow", "fast"]);
  });

  it("不同 key 互不阻塞", async () => {
    const order: string[] = [];
    const a = withKeyLock("a", async () => {
      await delay(30);
      order.push("a");
    });
    const b = withKeyLock("b", async () => {
      order.push("b");
    });
    await Promise.all([a, b]);
    expect(order).toEqual(["b", "a"]);
  });

  it("前序任务抛错不阻断后续任务", async () => {
    const failing = withKeyLock("k2", async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    await expect(withKeyLock("k2", async () => "ok")).resolves.toBe("ok");
  });

  it("返回值与抛错原样透传", async () => {
    await expect(withKeyLock("k3", async () => 42)).resolves.toBe(42);
  });
});
