import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface I18nDbSchema extends DBSchema {
  translations: {
    key: string;
    value: { packId: string; translations: Record<string, string> };
  };
  metadata: {
    key: string;
    value: { key: string; value: string };
  };
}

const dbName = "next-user-i18n";
const dbVersion = 1;
const activePackKey = "active-pack-id";
const translationsKey = "current-translations";

const isIndexedDbAvailable = (): boolean => {
  return typeof indexedDB !== "undefined";
};

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
          if (!db.objectStoreNames.contains("translations")) {
            db.createObjectStore("translations", { keyPath: "packId" });
          }
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
      await db.put("translations", { packId: translationsKey, translations });
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
  const indexed = isIndexedDbAvailable() ? createIndexedDbBackend() : null;
  const safeCall = async <T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch {
      return await fallback();
    }
  };
  return {
    async getTranslations(): Promise<Record<string, string> | null> {
      if (!indexed) return await memory.getTranslations();
      return await safeCall(() => indexed.getTranslations(), () => memory.getTranslations());
    },
    async setTranslations(packId: string | null, translations: Record<string, string>): Promise<void> {
      if (!indexed) return await memory.setTranslations(packId, translations);
      await safeCall(() => indexed.setTranslations(packId, translations), () => memory.setTranslations(packId, translations));
    },
    async getActivePackId(): Promise<string | null> {
      if (!indexed) return await memory.getActivePackId();
      return await safeCall(() => indexed.getActivePackId(), () => memory.getActivePackId());
    },
    async clear(): Promise<void> {
      if (!indexed) return await memory.clear();
      await safeCall(() => indexed.clear(), () => memory.clear());
    },
  };
})();
