import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createLocalePack,
  deleteLocalePack,
  getResolvedTranslations,
  listLocalePacks,
  setActiveLocalePack
} from "@/lib/server/locale-store";

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "nut-locale-store-"));
  process.env.DATA_DIR = dataDir;
});

afterAll(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("locale-store 基本流程", () => {
  it("创建→激活→解析翻译(用户包优先,内置兜底)", async () => {
    const pack = await createLocalePack({
      userId: "u-basic",
      name: "English",
      translations: { "theme.title": "Theme System" }
    });
    await expect(setActiveLocalePack("u-basic", pack.id)).resolves.toBe(true);
    const resolved = await getResolvedTranslations("u-basic");
    expect(resolved.packId).toBe(pack.id);
    expect(resolved.translations["theme.title"]).toBe("Theme System");
    // 用户包没覆盖的 key 由内置包兜底
    const builtinOnlyKeys = Object.keys(resolved.translations).length;
    expect(builtinOnlyKeys).toBeGreaterThan(1);
  });

  it("删除激活中的包后回退内置翻译", async () => {
    const pack = await createLocalePack({ userId: "u-del", name: "X", translations: {} });
    await setActiveLocalePack("u-del", pack.id);
    await expect(deleteLocalePack("u-del", pack.id)).resolves.toBe(true);
    const resolved = await getResolvedTranslations("u-del");
    expect(resolved.packId).toBeNull();
  });

  it("激活不存在的包返回 false", async () => {
    await expect(setActiveLocalePack("u-miss", "nope")).resolves.toBe(false);
  });
});

describe("locale-store 并发安全(T6)", () => {
  it("并发创建 8 个语言包,manifest 不丢条目", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createLocalePack({ userId: "u-conc", name: `pack-${i}`, translations: {} })
      )
    );
    const packs = await listLocalePacks("u-conc");
    expect(packs).toHaveLength(8);
  });
});
