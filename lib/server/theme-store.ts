import { promises as fs } from "node:fs";
import path from "node:path";
import { computeSha256Hex } from "@/lib/css-hash";
import type { UserCssRecord } from "@/lib/types";

interface UserThemeManifest {
  readonly currentVersion: string | null;
  readonly versions: ReadonlyArray<{ readonly version: string; readonly hash: string; readonly createdAt: number }>;
}

interface ThemeCacheEntry {
  readonly css: string;
  readonly record: UserCssRecord;
  readonly expiresAt: number;
}

const baseDir = path.join(process.cwd(), ".data", "user-themes");
const serverCache = new Map<string, ThemeCacheEntry>();

const getTtlMs = (): number => {
  const raw = process.env.THEME_CACHE_TTL;
  const seconds = raw ? Number.parseInt(raw, 10) : 3600;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 3600 * 1000;
};

const sanitizeSegment = (input: string): string => {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
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
  const record: UserCssRecord = { version, css, hash, createdAt, userId: input.userId };
  const manifestPath = getManifestPath(input.userId);
  const manifest = (await readJsonFile<UserThemeManifest>(manifestPath)) ?? getEmptyManifest();
  const nextVersions = [
    ...manifest.versions.filter((v) => v.version !== version),
    { version, hash, createdAt }
  ].sort((a, b) => b.createdAt - a.createdAt);
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

