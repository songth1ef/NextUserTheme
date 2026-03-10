"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { i18nCache } from "@/lib/i18n-cache";
import { interpolate } from "@/lib/i18n-interpolate";
import type { LocalePackInfo } from "@/lib/i18n-types";

interface I18nContextValue {
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly activePackId: string | null;
  readonly activePackName: string;
  readonly availablePacks: readonly LocalePackInfo[];
  readonly switchPack: (packId: string | null) => Promise<void>;
  readonly refreshPacks: () => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const message = typeof (json as any)?.message === "string" ? String((json as any).message) : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  if (!json) throw new Error("Invalid JSON response");
  return json;
};

interface I18nProviderProps {
  readonly children: ReactNode;
  readonly initialTranslations: Record<string, string>;
  readonly initialPackId: string | null;
  readonly initialPackName: string;
}

export function I18nProvider(props: I18nProviderProps) {
  const [translations, setTranslations] = useState<Record<string, string>>(props.initialTranslations);
  const [activePackId, setActivePackId] = useState<string | null>(props.initialPackId);
  const [activePackName, setActivePackName] = useState<string>(props.initialPackName);
  const [availablePacks, setAvailablePacks] = useState<LocalePackInfo[]>([]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const template = translations[key];
    if (template === undefined) return key;
    return interpolate(template, params);
  }, [translations]);

  const refreshPacks = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchJson<{ packs: LocalePackInfo[] }>("/api/user-i18n/packs");
      setAvailablePacks(data.packs ?? []);
    } catch {
      // silent
    }
  }, []);

  const switchPack = useCallback(async (packId: string | null): Promise<void> => {
    try {
      const data = await fetchJson<{
        success: boolean;
        activePackId: string | null;
        packName: string;
        translations: Record<string, string>;
      }>("/api/user-i18n/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      setTranslations(data.translations);
      setActivePackId(data.activePackId);
      setActivePackName(data.packName);
      await i18nCache.setTranslations(data.activePackId, data.translations);
    } catch (e) {
      console.error("Failed to switch locale pack:", e);
    }
  }, []);

  useEffect(() => {
    // Persist initial translations to cache
    void i18nCache.setTranslations(props.initialPackId, props.initialTranslations);
    void refreshPacks();
  }, [props.initialPackId, props.initialTranslations, refreshPacks]);

  const value = useMemo<I18nContextValue>(() => {
    return { t, activePackId, activePackName, availablePacks, switchPack, refreshPacks };
  }, [t, activePackId, activePackName, availablePacks, switchPack, refreshPacks]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
