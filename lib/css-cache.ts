import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { UserCssRecord } from "@/lib/types";

interface UserThemeDbSchema extends DBSchema {
  userCss: {
    key: string;
    value: UserCssRecord;
    indexes: { "by-createdAt": number };
  };
  metadata: {
    key: string;
    value: { key: string; value: string };
  };
}

const dbName = "next-user-theme";
const dbVersion = 1;
const currentVersionKey = "current-version";

const isIndexedDbAvailable = (): boolean => {
  return typeof indexedDB !== "undefined";
};

const createMemoryBackend = () => {
  const records = new Map<string, UserCssRecord>();
  let currentVersion: string | null = null;
  return {
    async getCss(version: string): Promise<UserCssRecord | null> {
      return records.get(version) ?? null;
    },
    async setCss(record: UserCssRecord): Promise<void> {
      records.set(record.version, record);
    },
    async getAllVersions(): Promise<string[]> {
      return Array.from(records.keys());
    },
    async deleteCss(version: string): Promise<void> {
      records.delete(version);
      if (currentVersion === version) currentVersion = null;
    },
    async getCurrentVersion(): Promise<string | null> {
      return currentVersion;
    },
    async setCurrentVersion(version: string | null): Promise<void> {
      currentVersion = version;
    },
    async getHistory(): Promise<UserCssRecord[]> {
      return Array.from(records.values()).sort((a, b) => b.createdAt - a.createdAt);
    }
  };
};

const createIndexedDbBackend = () => {
  let dbPromise: Promise<IDBPDatabase<UserThemeDbSchema>> | null = null;
  const getDb = async (): Promise<IDBPDatabase<UserThemeDbSchema>> => {
    if (!dbPromise) {
      dbPromise = openDB<UserThemeDbSchema>(dbName, dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("userCss")) {
            const store = db.createObjectStore("userCss", { keyPath: "version" });
            store.createIndex("by-createdAt", "createdAt");
          }
          if (!db.objectStoreNames.contains("metadata")) {
            db.createObjectStore("metadata", { keyPath: "key" });
          }
        }
      });
    }
    return await dbPromise;
  };
  return {
    async getCss(version: string): Promise<UserCssRecord | null> {
      const db = await getDb();
      const record = await db.get("userCss", version);
      return record ?? null;
    },
    async setCss(record: UserCssRecord): Promise<void> {
      const db = await getDb();
      await db.put("userCss", record);
    },
    async getAllVersions(): Promise<string[]> {
      const db = await getDb();
      const keys = await db.getAllKeys("userCss");
      return keys.map(String);
    },
    async deleteCss(version: string): Promise<void> {
      const db = await getDb();
      await db.delete("userCss", version);
      const current = await db.get("metadata", currentVersionKey);
      if (current?.value === version) await db.delete("metadata", currentVersionKey);
    },
    async getCurrentVersion(): Promise<string | null> {
      const db = await getDb();
      const current = await db.get("metadata", currentVersionKey);
      return current?.value ?? null;
    },
    async setCurrentVersion(version: string | null): Promise<void> {
      const db = await getDb();
      if (!version) {
        await db.delete("metadata", currentVersionKey);
        return;
      }
      await db.put("metadata", { key: currentVersionKey, value: version });
    },
    async getHistory(): Promise<UserCssRecord[]> {
      const db = await getDb();
      const records = await db.getAllFromIndex("userCss", "by-createdAt");
      return records.sort((a, b) => b.createdAt - a.createdAt);
    }
  };
};

export interface CssCache {
  getCss(version: string): Promise<UserCssRecord | null>;
  setCss(record: UserCssRecord): Promise<void>;
  getAllVersions(): Promise<string[]>;
  deleteCss(version: string): Promise<void>;
  getCurrentVersion(): Promise<string | null>;
  setCurrentVersion(version: string | null): Promise<void>;
  getHistory(): Promise<UserCssRecord[]>;
}

export const cssCache: CssCache = (() => {
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
    async getCss(version: string): Promise<UserCssRecord | null> {
      if (!indexed) return await memory.getCss(version);
      return await safeCall(() => indexed.getCss(version), () => memory.getCss(version));
    },
    async setCss(record: UserCssRecord): Promise<void> {
      if (!indexed) return await memory.setCss(record);
      await safeCall(() => indexed.setCss(record), () => memory.setCss(record));
    },
    async getAllVersions(): Promise<string[]> {
      if (!indexed) return await memory.getAllVersions();
      return await safeCall(() => indexed.getAllVersions(), () => memory.getAllVersions());
    },
    async deleteCss(version: string): Promise<void> {
      if (!indexed) return await memory.deleteCss(version);
      await safeCall(() => indexed.deleteCss(version), () => memory.deleteCss(version));
    },
    async getCurrentVersion(): Promise<string | null> {
      if (!indexed) return await memory.getCurrentVersion();
      return await safeCall(() => indexed.getCurrentVersion(), () => memory.getCurrentVersion());
    },
    async setCurrentVersion(version: string | null): Promise<void> {
      if (!indexed) return await memory.setCurrentVersion(version);
      await safeCall(() => indexed.setCurrentVersion(version), () => memory.setCurrentVersion(version));
    },
    async getHistory(): Promise<UserCssRecord[]> {
      if (!indexed) return await memory.getHistory();
      return await safeCall(() => indexed.getHistory(), () => memory.getHistory());
    }
  };
})();

