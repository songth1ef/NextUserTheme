import { promises as fs } from "node:fs";
import path from "node:path";
import { computeSha256Hex } from "@/lib/css-hash";
import { sanitizeSegment } from "@/lib/server/sanitize";
import type { UserLocalePack, UserLocaleManifest, LocalePackInfo } from "@/lib/i18n-types";
import builtinZhCN from "@/locales/zh-CN.json";

interface LocaleCacheEntry {
  readonly translations: Record<string, string>;
  readonly expiresAt: number;
}

const baseDir = path.join(process.cwd(), ".data", "user-locales");
const serverCache = new Map<string, LocaleCacheEntry>();

const getTtlMs = (): number => {
  const raw = process.env.I18N_CACHE_TTL;
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

const getPackPath = (userId: string, packId: string): string => {
  return path.join(getUserDir(userId), `${sanitizeSegment(packId)}.json`);
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

const getEmptyManifest = (): UserLocaleManifest => {
  return { activePackId: null, packs: [] };
};

const getCacheKey = (userId: string): string => {
  return `locale:${userId}`;
};

const getFromCache = (userId: string): LocaleCacheEntry | null => {
  const key = getCacheKey(userId);
  const entry = serverCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    serverCache.delete(key);
    return null;
  }
  return entry;
};

const setTranslationsCache = (userId: string, translations: Record<string, string>): void => {
  const ttlMs = getTtlMs();
  const key = getCacheKey(userId);
  serverCache.set(key, { translations, expiresAt: Date.now() + ttlMs });
};

const invalidateCache = (userId: string): void => {
  serverCache.delete(getCacheKey(userId));
};

export function getBuiltinTranslations(): Record<string, string> {
  return { ...builtinZhCN };
}

export async function getLocaleManifest(userId: string): Promise<UserLocaleManifest> {
  await ensureUserDir(userId);
  return (await readJsonFile<UserLocaleManifest>(getManifestPath(userId))) ?? getEmptyManifest();
}

export async function getLocalePack(userId: string, packId: string): Promise<UserLocalePack | null> {
  await ensureUserDir(userId);
  return await readJsonFile<UserLocalePack>(getPackPath(userId, packId));
}

export async function listLocalePacks(userId: string): Promise<LocalePackInfo[]> {
  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserLocaleManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  // 并行读取所有语言包文件，避免 N+1 串行 I/O
  const packFiles = await Promise.all(
    manifest.packs.map((entry) => readJsonFile<UserLocalePack>(getPackPath(userId, entry.id)))
  );
  return manifest.packs.map((entry, i) => ({
    id: entry.id,
    name: entry.name,
    keyCount: packFiles[i] ? Object.keys(packFiles[i]!.translations).length : 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
}

export interface CreateLocalePackInput {
  readonly userId: string;
  readonly name: string;
  readonly translations?: Record<string, string>;
}

export async function createLocalePack(input: CreateLocalePackInput): Promise<UserLocalePack> {
  await ensureUserDir(input.userId);
  const now = Date.now();
  const hash = computeSha256Hex(input.name + String(now));
  const packId = `${sanitizeSegment(input.userId)}-${hash.slice(0, 12)}`;
  const pack: UserLocalePack = {
    id: packId,
    userId: input.userId,
    name: input.name,
    translations: input.translations ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const manifestPath = getManifestPath(input.userId);
  const manifest = (await readJsonFile<UserLocaleManifest>(manifestPath)) ?? getEmptyManifest();
  const nextPacks = [
    ...manifest.packs,
    { id: packId, name: input.name, createdAt: now, updatedAt: now },
  ];
  await writeJsonFile(getPackPath(input.userId, packId), pack);
  await writeJsonFile(manifestPath, { ...manifest, packs: nextPacks });
  invalidateCache(input.userId);
  return pack;
}

export async function updateLocalePack(userId: string, packId: string, updates: { name?: string; translations?: Record<string, string> }): Promise<UserLocalePack | null> {
  await ensureUserDir(userId);
  const pack = await readJsonFile<UserLocalePack>(getPackPath(userId, packId));
  if (!pack) return null;
  const now = Date.now();
  const updated: UserLocalePack = {
    ...pack,
    name: updates.name ?? pack.name,
    translations: updates.translations ?? pack.translations,
    updatedAt: now,
  };
  await writeJsonFile(getPackPath(userId, packId), updated);
  // Update manifest if name changed
  if (updates.name) {
    const manifestPath = getManifestPath(userId);
    const manifest = (await readJsonFile<UserLocaleManifest>(manifestPath)) ?? getEmptyManifest();
    const nextPacks = manifest.packs.map((p) =>
      p.id === packId ? { ...p, name: updates.name!, updatedAt: now } : p
    );
    await writeJsonFile(manifestPath, { ...manifest, packs: nextPacks });
  }
  invalidateCache(userId);
  return updated;
}

export async function deleteLocalePack(userId: string, packId: string): Promise<boolean> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserLocaleManifest>(manifestPath)) ?? getEmptyManifest();
  const exists = manifest.packs.some((p) => p.id === packId);
  if (!exists) return false;
  const nextPacks = manifest.packs.filter((p) => p.id !== packId);
  const nextActive = manifest.activePackId === packId ? null : manifest.activePackId;
  await writeJsonFile(manifestPath, { activePackId: nextActive, packs: nextPacks });
  try { await fs.unlink(getPackPath(userId, packId)); } catch { /* ignore */ }
  invalidateCache(userId);
  return true;
}

export async function setActiveLocalePack(userId: string, packId: string | null): Promise<boolean> {
  await ensureUserDir(userId);
  const manifestPath = getManifestPath(userId);
  const manifest = (await readJsonFile<UserLocaleManifest>(manifestPath)) ?? getEmptyManifest();
  if (packId !== null) {
    const exists = manifest.packs.some((p) => p.id === packId);
    if (!exists) return false;
  }
  await writeJsonFile(manifestPath, { ...manifest, activePackId: packId });
  invalidateCache(userId);
  return true;
}

export interface ResolvedTranslations {
  readonly packId: string | null;
  readonly packName: string;
  readonly translations: Record<string, string>;
}

export async function getResolvedTranslations(userId: string): Promise<ResolvedTranslations> {
  const builtin = getBuiltinTranslations();
  const builtinName = builtin["locale.builtinName"] ?? "简体中文（预置）";

  await ensureUserDir(userId);
  const manifest = (await readJsonFile<UserLocaleManifest>(getManifestPath(userId))) ?? getEmptyManifest();
  if (!manifest.activePackId) {
    return { packId: null, packName: builtinName, translations: builtin };
  }

  // Check cache
  const cached = getFromCache(userId);
  if (cached) {
    const packEntry = manifest.packs.find((p) => p.id === manifest.activePackId);
    return {
      packId: manifest.activePackId,
      packName: packEntry?.name ?? manifest.activePackId,
      translations: cached.translations,
    };
  }

  const pack = await readJsonFile<UserLocalePack>(getPackPath(userId, manifest.activePackId));
  if (!pack) {
    return { packId: null, packName: builtinName, translations: builtin };
  }

  const merged = { ...builtin, ...pack.translations };
  setTranslationsCache(userId, merged);

  return {
    packId: manifest.activePackId,
    packName: pack.name,
    translations: merged,
  };
}
