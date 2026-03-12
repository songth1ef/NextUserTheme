import { promises as fs } from "node:fs";
import path from "node:path";
import { computeSha256Hex } from "@/lib/css-hash";
import { sanitizeSegment } from "@/lib/server/sanitize";
import type { ColorMode, UserCssRecord, VersionInfo } from "@/lib/types";

interface UserThemeManifest {
  readonly currentVersion: string | null;
  readonly colorMode?: ColorMode;
  readonly versions: ReadonlyArray<{ readonly version: string; readonly versionName: string; readonly hash: string; readonly createdAt: number }>;
}

interface ThemeCacheEntry {
  readonly css: string;
  readonly record: UserCssRecord;
  readonly expiresAt: number;
}

const baseDir = path.join(process.cwd(), ".data", "user-themes");
const serverCache = new Map<string, ThemeCacheEntry>();

// 每个用户最多保留的主题版本数，防止磁盘被无限写满
const MAX_VERSIONS_PER_USER = 50;

const getTtlMs = (): number => {
  const raw = process.env.THEME_CACHE_TTL;
  const seconds = raw ? Number.parseInt(raw, 10) : 3600;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 3600 * 1000;
};

const getUserDir = (userId: string): string => {
  return path.join(baseDir, sanitizeSegment(userId));
};

const getManifestPath = (userId: string): string => {
  return path.join(getUserDir(userId), "manifest.json");
};

const getCssPath = (userId: string, version: string): string => {
  return path.join(getUserDir(userId), `${sanitizeSegment(version)}.css`);
};

const getRecordPath = (userId: string, version: string): string => {
  return path.join(getUserDir(userId), `${sanitizeSegment(version)}.json`);
};

const ensureUserDir = async (userId: string): Promise<void> => {
  await fs.mkdir(getUserDir(userId), { recursive: true });
};

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  const json = JSON.stringify(value, null, 2);
  await fs.writeFile(filePath, json, "utf8");
};

const getEmptyManifest = (): UserThemeManifest => {
  return { currentVersion: null, versions: [] };
};

const getCacheKey = (userId: string, version: string): string => {
  return `${userId}:${version}`;
};

const getFromCache = (userId: string, version: string): ThemeCacheEntry | null => {
  const key = getCacheKey(userId, version);
  const entry = serverCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    serverCache.delete(key);
    return null;
  }
  return entry;
};

const setCache = (userId: string, version: string, css: string, record: UserCssRecord): void => {
  const ttlMs = getTtlMs();
  const key = getCacheKey(userId, version);
  serverCache.set(key, { css, record, expiresAt: Date.now() + ttlMs });
};

export interface SaveUserThemeInput {
  readonly userId: string;
  readonly css: string;
  readonly versionName: string;
}

export interface SaveUserThemeResult {
  readonly version: string;
  readonly hash: string;
  readonly record: UserCssRecord;
}

export async function saveUserTheme(input: SaveUserThemeInput): Promise<SaveUserThemeResult> {
  await ensureUserDir(input.userId);
  const css = input.css;
  const createdAt = Date.now();
  const hash = computeSha256Hex(css);
  const version = `${sanitizeSegment(input.userId)}-${hash.slice(0, 12)}`;
  const versionName = input.versionName;
  const record: UserCssRecord = { version, versionName, css, hash, createdAt, userId: input.userId };
  const manifestPath = getManifestPath(input.userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  const deduplicated = [
    ...manifest.versions.filter((v) => v.version !== version),
    { version, versionName, hash, createdAt }
  ].sort((a, b) => b.createdAt - a.createdAt);
  // 超出上限时淘汰最旧版本，避免无限占用磁盘
  const evicted = deduplicated.slice(MAX_VERSIONS_PER_USER);
  const nextVersions = deduplicated.slice(0, MAX_VERSIONS_PER_USER);
  for (const old of evicted) {
    try { await fs.unlink(getCssPath(input.userId, old.version)); } catch { /* ignore */ }
    try { await fs.unlink(getRecordPath(input.userId, old.version)); } catch { /* ignore */ }
    serverCache.delete(getCacheKey(input.userId, old.version));
  }
  const nextManifest: UserThemeManifest = { currentVersion: version, versions: nextVersions };
  await fs.writeFile(getCssPath(input.userId, version), css, "utf8");
  await writeJsonFile(getRecordPath(input.userId, version), record);
  await writeJsonFile(manifestPath, nextManifest);
  setCache(input.userId, version, css, record);
  return { version, hash, record };
}

export interface UserThemeInfo {
  readonly userId: string;
  readonly hasCustomTheme: boolean;
  readonly userThemeVersion?: string;
  readonly userThemeHash?: string;
  readonly userCSSUrl?: string;
}

export async function getUserThemeInfo(userId: string): Promise<UserThemeInfo> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  const currentVersion = manifest.currentVersion;
  if (!currentVersion) return { userId, hasCustomTheme: false };
  const record = await readJsonFile<UserCssRecord>(getRecordPath(userId, currentVersion));
  if (!record) return { userId, hasCustomTheme: false };
  return {
    userId,
    hasCustomTheme: true,
    userThemeVersion: record.version,
    userThemeHash: record.hash,
    userCSSUrl: `/api/user-theme/${encodeURIComponent(record.version)}`
  };
}

export async function listUserThemeVersions(userId: string): Promise<string[]> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  return manifest.versions.map((v) => v.version);
}

export async function listUserThemeVersionsDetailed(userId: string): Promise<VersionInfo[]> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  return manifest.versions.map((v) => ({
    version: v.version,
    versionName: v.versionName ?? v.version,
    hash: v.hash,
    createdAt: v.createdAt
  }));
}

export async function deleteUserThemeVersion(userId: string, version: string): Promise<boolean> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  const exists = manifest.versions.some((v) => v.version === version);
  if (!exists) return false;
  const nextVersions = manifest.versions.filter((v) => v.version !== version);
  const nextCurrent = manifest.currentVersion === version ? null : manifest.currentVersion;
  await writeJsonFile(manifestPath, { currentVersion: nextCurrent, versions: nextVersions });
  // 删除文件
  try { await fs.unlink(getCssPath(userId, version)); } catch { /* ignore */ }
  try { await fs.unlink(getRecordPath(userId, version)); } catch { /* ignore */ }
  serverCache.delete(getCacheKey(userId, version));
  return true;
}

export async function renameUserThemeVersion(userId: string, version: string, newName: string): Promise<boolean> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  const idx = manifest.versions.findIndex((v) => v.version === version);
  if (idx === -1) return false;
  const nextVersions = manifest.versions.map((v) =>
    v.version === version ? { ...v, versionName: newName } : v
  );
  await writeJsonFile(manifestPath, { ...manifest, versions: nextVersions });
  // 更新 record 文件
  const recordPath = getRecordPath(userId, version);
  const record = await readJsonFile<UserCssRecord>(recordPath);
  if (record) {
    await writeJsonFile(recordPath, { ...record, versionName: newName });
  }
  return true;
}

export async function getUserThemeRecord(userId: string, version: string): Promise<UserCssRecord | null> {
  await ensureUserDir(userId);
  const cached = getFromCache(userId, version);
  if (cached) return cached.record;
  const record = await readJsonFile<UserCssRecord>(getRecordPath(userId, version));
  if (!record) return null;
  const css = await getUserThemeCss(userId, version);
  if (css !== null) setCache(userId, version, css, record);
  return record;
}

export async function getUserThemeCss(userId: string, version: string): Promise<string | null> {
  await ensureUserDir(userId);
  const cached = getFromCache(userId, version);
  if (cached) return cached.css;
  try {
    const css = await fs.readFile(getCssPath(userId, version), "utf8");
    const record = (await readJsonFile<UserCssRecord>(getRecordPath(userId, version))) ?? { version, css, hash: computeSha256Hex(css), createdAt: Date.now(), userId };
    setCache(userId, version, css, record);
    return css;
  } catch {
    return null;
  }
}

export async function getColorMode(userId: string): Promise<ColorMode> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  return manifest.colorMode ?? "dark";
}

export async function setColorMode(userId: string, mode: ColorMode): Promise<void> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  await writeJsonFile(manifestPath, { ...manifest, colorMode: mode });
}

export async function getCurrentUserTheme(userId: string): Promise<{ record: UserCssRecord; css: string } | null> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  const currentVersion = manifest.currentVersion;
  if (!currentVersion) return null;
  const cached = getFromCache(userId, currentVersion);
  if (cached) return { record: cached.record, css: cached.css };
  const record = await readJsonFile<UserCssRecord>(getRecordPath(userId, currentVersion));
  if (!record) return null;
  const css = await getUserThemeCss(userId, currentVersion);
  if (css === null) return null;
  setCache(userId, currentVersion, css, record);
  return { record, css };
}

export async function setCurrentUserThemeVersion(userId: string, version: string | null): Promise<boolean> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  
  // 如果设置为 null，直接更新
  if (version === null) {
    const nextManifest: UserThemeManifest = { ...manifest, currentVersion: null };
    await writeJsonFile(manifestPath, nextManifest);
    return true;
  }
  
  // 验证版本是否存在
  const versionExists = manifest.versions.some((v) => v.version === version);
  if (!versionExists) {
    // 尝试从文件系统读取，可能版本存在但不在 manifest 中
    const record = await readJsonFile<UserCssRecord>(getRecordPath(userId, version));
    if (!record) return false;
    
    // 添加到 versions 列表
    const nextVersions = [
      ...manifest.versions.filter((v) => v.version !== version),
      { version, versionName: record.versionName ?? version, hash: record.hash, createdAt: record.createdAt }
    ].sort((a, b) => b.createdAt - a.createdAt);
    
    const nextManifest: UserThemeManifest = { currentVersion: version, versions: nextVersions };
    await writeJsonFile(manifestPath, nextManifest);
    return true;
  }
  
  // 更新当前版本
  const nextManifest: UserThemeManifest = { ...manifest, currentVersion: version };
  await writeJsonFile(manifestPath, nextManifest);
  return true;
}

