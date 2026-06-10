import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteUserThemeVersion,
  getColorMode,
  getUserThemeRecord,
  getUserThemeCss,
  listUserThemeVersionsDetailed,
  saveUserTheme,
  setColorMode
} from "@/lib/server/theme-store";

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "nut-theme-store-"));
  process.env.DATA_DIR = dataDir;
});

afterAll(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("theme-store 基本读写", () => {
  it("保存后可列出并读回 CSS", async () => {
    const saved = await saveUserTheme({ userId: "u-basic", css: ":root { --x: 1; }", versionName: "v1" });
    expect(saved.version).toMatch(/^u-basic-[0-9a-f]{12}$/);
    const versions = await listUserThemeVersionsDetailed("u-basic");
    expect(versions.map((v) => v.version)).toContain(saved.version);
    await expect(getUserThemeCss("u-basic", saved.version)).resolves.toBe(":root { --x: 1; }");
  });

  it("删除版本后列表与当前版本同步清理", async () => {
    const saved = await saveUserTheme({ userId: "u-del", css: ":root { --y: 2; }", versionName: "v" });
    await expect(deleteUserThemeVersion("u-del", saved.version)).resolves.toBe(true);
    const versions = await listUserThemeVersionsDetailed("u-del");
    expect(versions).toEqual([]);
  });
});

describe("theme-store 并发安全(T6)", () => {
  it("并发保存 8 个不同主题,manifest 不丢版本", async () => {
    const inputs = Array.from({ length: 8 }, (_, i) => ({
      userId: "u-conc",
      css: `:root { --i: ${i}; }`,
      versionName: `v${i}`
    }));
    await Promise.all(inputs.map((input) => saveUserTheme(input)));
    const versions = await listUserThemeVersionsDetailed("u-conc");
    expect(versions).toHaveLength(8);
  });

  it("保存与改色彩模式并发,两者都不被覆盖丢失", async () => {
    await Promise.all([
      saveUserTheme({ userId: "u-mix", css: ":root { --m: 1; }", versionName: "v" }),
      setColorMode("u-mix", "light")
    ]);
    const versions = await listUserThemeVersionsDetailed("u-mix");
    expect(versions).toHaveLength(1);
    await expect(getColorMode("u-mix")).resolves.toBe("light");
  });
});

describe("theme-store record 兜底(T7)", () => {
  it("record 文件缺失时回退 manifest 元数据,不伪造 createdAt", async () => {
    // 手工构造:有 manifest 与 css 文件,无 record(.json)文件
    const userId = "u-fallback";
    const version = `${userId}-abcdef123456`;
    const createdAt = 1700000000000;
    const userDir = path.join(dataDir, "user-themes", userId);
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(path.join(userDir, `${version}.css`), ":root { --f: 1; }", "utf8");
    await fs.writeFile(
      path.join(userDir, "manifest.json"),
      JSON.stringify({
        currentVersion: version,
        versions: [{ version, versionName: "兜底版本", hash: "deadbeef", createdAt }]
      }),
      "utf8"
    );

    await expect(getUserThemeCss(userId, version)).resolves.toBe(":root { --f: 1; }");
    const record = await getUserThemeRecord(userId, version);
    expect(record?.createdAt).toBe(createdAt);
    expect(record?.versionName).toBe("兜底版本");
    expect(record?.hash).toBe("deadbeef");
  });
});
