import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { idbUtils } from "@/lib/idb-utils";

interface I18nDbSchema extends DBSchema {
  translations: {
    key: string;
    value: { cacheKey: string; translations: Record<string, string> };
  };
  metadata: {
    key: string;
    value: { key: string; value: string };
  };
}

const dbName = "next-user-i18n";
const dbVersion = 2;
const activePackKey = "active-pack-id";
const translationsKey = "current-translations";

const createMemoryBackend = () => {
  let currentPackId: string | null = null;
  let currentTranslations: Record<string, string> | null = null;
  return {
    async getTranslations(): Promise<Record<string, string> | null> {
      return currentTranslations;
    },
    async setTranslations(packId: string | null, translations: Record<string, string>): Promise<void> {
      currentPackId = packId;
      currentTranslations = translations;
    },
    async getActivePackId(): Promise<string | null> {
      return currentPackId;
    },
    async clear(): Promise<void> {
      currentPackId = null;
      currentTranslations = null;
    },
  };
};

const createIndexedDbBackend = () => {
  let dbPromise: Promise<IDBPDatabase<I18nDbSchema>> | null = null;
  const getDb = async (): Promise<IDBPDatabase<I18nDbSchema>> => {
    if (!dbPromise) {
      dbPromise = openDB<I18nDbSchema>(dbName, dbVersion, {
        upgrade(db) {
          // 单条覆盖式缓存：translations store 只存一条记录（cacheKey 固定为 translationsKey）
          // v1 误用 packId 作为 keyPath（实际写入的是常量），v2 统一改为 cacheKey，并允许直接丢弃旧缓存。
          if (db.objectStoreNames.contains("translations")) db.deleteObjectStore("translations");
          db.createObjectStore("translations", { keyPath: "cacheKey" });
          if (!db.objectStoreNames.contains("metadata")) {
            db.createObjectStore("metadata", { keyPath: "key" });
          }
        },
      });
    }
    return await dbPromise;
  };
  return {
    async getTranslations(): Promise<Record<string, string> | null> {
      const db = await getDb();
      const entry = await db.get("translations", translationsKey);
      return entry?.translations ?? null;
    },
    async setTranslations(packId: string | null, translations: Record<string, string>): Promise<void> {
      const db = await getDb();
      await db.put("translations", { cacheKey: translationsKey, translations });
      if (packId !== null) {
        await db.put("metadata", { key: activePackKey, value: packId });
      } else {
        await db.delete("metadata", activePackKey);
      }
    },
    async getActivePackId(): Promise<string | null> {
      const db = await getDb();
      const entry = await db.get("metadata", activePackKey);
      return entry?.value ?? null;
    },
    async clear(): Promise<void> {
      const db = await getDb();
      await db.delete("translations", translationsKey);
      await db.delete("metadata", activePackKey);
    },
  };
};

export interface I18nCache {
  getTranslations(): Promise<Record<string, string> | null>;
  setTranslations(packId: string | null, translations: Record<string, string>): Promise<void>;
  getActivePackId(): Promise<string | null>;
  clear(): Promise<void>;
}

export const i18nCache: I18nCache = (() => {
  const memory = createMemoryBackend();
  const indexed = idbUtils.isIndexedDbAvailable() ? createIndexedDbBackend() : null;
  return {
    async getTranslations(): Promise<Record<string, string> | null> {
      if (!indexed) return await memory.getTranslations();
      return await idbUtils.safeCall(() => indexed.getTranslations(), () => memory.getTranslations());
    },
    async setTranslations(packId: string | null, translations: Record<string, string>): Promise<void> {
      if (!indexed) return await memory.setTranslations(packId, translations);
      await idbUtils.safeCall(() => indexed.setTranslations(packId, translations), () => memory.setTranslations(packId, translations));
    },
    async getActivePackId(): Promise<string | null> {
      if (!indexed) return await memory.getActivePackId();
      return await idbUtils.safeCall(() => indexed.getActivePackId(), () => memory.getActivePackId());
    },
    async clear(): Promise<void> {
      if (!indexed) return await memory.clear();
      await idbUtils.safeCall(() => indexed.clear(), () => memory.clear());
    },
  };
})();
