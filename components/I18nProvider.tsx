"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { i18nCache } from "@/lib/i18n-cache";
import { interpolate } from "@/lib/i18n-interpolate";
import type { LocalePackInfo } from "@/lib/i18n-types";
import { fetchJson } from "@/lib/fetch-json";

interface I18nContextValue {
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly activePackId: string | null;
  readonly activePackName: string;
  readonly availablePacks: readonly LocalePackInfo[];
  readonly switchPack: (packId: string | null) => Promise<void>;
  readonly refreshPacks: () => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

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
