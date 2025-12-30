"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cssCache } from "@/lib/css-cache";
import { computeSha256Hex } from "@/lib/css-hash";
import { injectStyle, removeAllUserThemeStyles, removeStyle } from "@/lib/css-injector";
import { validateUserCss } from "@/lib/css-validator";
import type { UserCssRecord } from "@/lib/types";

interface ThemeContextValue {
  readonly currentVersion: string | null;
  readonly availableVersions: readonly string[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly switchTheme: (version: string) => Promise<void>;
  readonly revertToOfficial: () => Promise<void>;
  readonly refreshTheme: () => Promise<void>;
  readonly getThemeHistory: () => Promise<UserCssRecord[]>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

const setBodyThemeClass = (enabled: boolean): void => {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.body.classList.add("user-theme");
    return;
  }
  document.body.classList.remove("user-theme");
};

const getSsrStyleCss = (version: string): string | null => {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(`user-theme-${version}`);
  if (!el) return null;
  if (el.tagName.toLowerCase() !== "style") return null;
  const css = (el as HTMLStyleElement).textContent ?? "";
  return css.trim().length > 0 ? css : null;
};

interface UserInfoResponse {
  readonly userId: string;
  readonly hasCustomTheme: boolean;
  readonly userThemeVersion?: string;
  readonly userThemeHash?: string;
  readonly userCSSUrl?: string;
}

export function ThemeProvider(props: { readonly children: ReactNode; readonly initialVersion?: string | null }) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(props.initialVersion ?? null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const requestSeq = useRef<number>(0);
  const applyVersion = useCallback(async (input: { version: string; expectedHash?: string; cssUrl?: string; preferSsr?: boolean }): Promise<void> => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    const styleId = `user-theme-${input.version}`;
    const done = async (css: string, hash: string): Promise<void> => {
      if (requestSeq.current !== seq) return;
      const record: UserCssRecord = { version: input.version, css, hash, createdAt: Date.now() };
      await cssCache.setCss(record);
      await cssCache.setCurrentVersion(input.version);
      injectStyle(styleId, css);
      setBodyThemeClass(true);
      setCurrentVersion(input.version);
    };
    try {
      if (input.preferSsr) {
        const ssrCss = getSsrStyleCss(input.version);
        if (ssrCss) {
          const hash = computeSha256Hex(ssrCss);
          await done(ssrCss, hash);
          return;
        }
      }
      const cached = await cssCache.getCss(input.version);
      if (cached) {
        if (!input.expectedHash || cached.hash === input.expectedHash) {
          await done(cached.css, cached.hash);
          return;
        }
      }
      const cssUrl = input.cssUrl ?? `/api/user-theme/${encodeURIComponent(input.version)}`;
      const res = await fetch(cssUrl, { cache: "no-store" });
      const css = await res.text();
      if (!res.ok) throw new Error(`Fetch CSS failed: ${res.status}`);
      const validation = validateUserCss(css);
      if (!validation.valid) throw new Error(`CSS validation failed: ${validation.errors[0]?.message ?? "unknown"}`);
      const hash = computeSha256Hex(css);
      if (input.expectedHash && hash !== input.expectedHash) throw new Error("Hash mismatch");
      await done(css, hash);
    } catch (e) {
      if (requestSeq.current !== seq) return;
      setError(e instanceof Error ? e : new Error("Unknown error"));
      setIsLoading(false);
      throw e;
    } finally {
      if (requestSeq.current !== seq) return;
      setIsLoading(false);
    }
  }, []);
  const refreshVersions = useCallback(async (): Promise<void> => {
    const [server, local] = await Promise.all([
      fetchJson<{ versions: string[] }>("/api/user-theme/versions").catch(() => ({ versions: [] })),
      cssCache.getAllVersions().catch(() => [])
    ]);
    const merged = Array.from(new Set([...(server.versions ?? []), ...local])).filter((v) => typeof v === "string" && v.length > 0);
    merged.sort();
    setAvailableVersions(merged);
  }, []);
  const refreshTheme = useCallback(async (): Promise<void> => {
    const userInfo = await fetchJson<UserInfoResponse>("/api/user/info", { cache: "no-store" });
    await refreshVersions();
    if (!userInfo.hasCustomTheme || !userInfo.userThemeVersion) {
      removeAllUserThemeStyles();
      setBodyThemeClass(false);
      setCurrentVersion(null);
      await cssCache.setCurrentVersion(null);
      return;
    }
    await applyVersion({
      version: userInfo.userThemeVersion,
      expectedHash: userInfo.userThemeHash,
      cssUrl: userInfo.userCSSUrl,
      preferSsr: true
    });
  }, [applyVersion, refreshVersions]);
  useEffect(() => {
    void refreshTheme();
  }, [refreshTheme]);
  const switchTheme = useCallback(async (version: string): Promise<void> => {
    const trimmed = version.trim();
    if (trimmed.length === 0) return;
    if (currentVersion) removeStyle(`user-theme-${currentVersion}`);
    await applyVersion({ version: trimmed });
    
    // 更新服务端的当前版本，确保刷新后保持
    try {
      await fetchJson<{ success: boolean }>("/api/user-theme/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: trimmed })
      });
    } catch (error) {
      console.error("Failed to update server current version:", error);
      // 不抛出错误，客户端已切换成功
    }
    
    await refreshVersions();
  }, [applyVersion, currentVersion, refreshVersions]);
  const revertToOfficial = useCallback(async (): Promise<void> => {
    removeAllUserThemeStyles();
    setBodyThemeClass(false);
    setCurrentVersion(null);
    await cssCache.setCurrentVersion(null);
    
    // 更新服务端的当前版本为 null
    try {
      await fetchJson<{ success: boolean }>("/api/user-theme/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: null })
      });
    } catch (error) {
      console.error("Failed to update server current version:", error);
    }
  }, []);
  const getThemeHistory = useCallback(async (): Promise<UserCssRecord[]> => {
    return await cssCache.getHistory();
  }, []);
  const value = useMemo<ThemeContextValue>(() => {
    return { currentVersion, availableVersions, isLoading, error, switchTheme, revertToOfficial, refreshTheme, getThemeHistory };
  }, [availableVersions, currentVersion, error, getThemeHistory, isLoading, refreshTheme, revertToOfficial, switchTheme]);
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

