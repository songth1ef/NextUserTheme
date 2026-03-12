"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cssCache } from "@/lib/css-cache";
import { computeSha256Hex } from "@/lib/css-hash";
import { injectStyle, removeAllUserThemeStyles, removeStyle } from "@/lib/css-injector";
import { validateUserCss } from "@/lib/css-validator";
import { fetchJson } from "@/lib/fetch-json";
import type { UserCssRecord, VersionInfo } from "@/lib/types";

interface ThemeContextValue {
  readonly currentVersion: string | null;
  readonly availableVersions: readonly string[];
  readonly versionDetails: readonly VersionInfo[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly lastApplyTimeMs: number | null;
  readonly switchTheme: (version: string) => Promise<void>;
  readonly revertToOfficial: () => Promise<void>;
  readonly refreshTheme: () => Promise<void>;
  readonly deleteVersion: (version: string) => Promise<void>;
  readonly renameVersion: (version: string, newName: string) => Promise<void>;
  readonly getThemeHistory: () => Promise<UserCssRecord[]>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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
  const el = document.getElementById(`uth-${version}`);
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

interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly initialVersion: string | null;
  readonly ssrApplied: boolean;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(props.initialVersion ?? null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [versionDetails, setVersionDetails] = useState<VersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastApplyTimeMs, setLastApplyTimeMs] = useState<number | null>(null);
  const requestSeq = useRef<number>(0);
  const applyVersion = useCallback(async (input: { version: string; expectedHash?: string; cssUrl?: string; preferSsr?: boolean; silent?: boolean }): Promise<void> => {
    const seq = ++requestSeq.current;
    const startTime = performance.now();
    if (!input.silent) {
      setIsLoading(true);
      setError(null);
      setLastApplyTimeMs(null);
    }
    const styleId = `uth-${input.version}`;
    const done = async (css: string, hash: string): Promise<void> => {
      if (requestSeq.current !== seq) return;
      const record: UserCssRecord = { version: input.version, css, hash, createdAt: Date.now() };
      await cssCache.setCss(record);
      await cssCache.setCurrentVersion(input.version);
      injectStyle(styleId, css);
      setBodyThemeClass(true);
      setCurrentVersion(input.version);
      if (!input.silent) {
        const elapsed = performance.now() - startTime;
        setLastApplyTimeMs(Math.round(elapsed * 100) / 100);
      }
    };
    try {
      if (input.preferSsr) {
        const ssrCss = getSsrStyleCss(input.version);
        if (ssrCss) {
          const hash = computeSha256Hex(ssrCss);
          if (!input.expectedHash || hash === input.expectedHash) {
            if (!input.silent) {
              await done(ssrCss, hash);
            } else {
              const record: UserCssRecord = { version: input.version, css: ssrCss, hash, createdAt: Date.now() };
              await cssCache.setCss(record);
              await cssCache.setCurrentVersion(input.version);
              setBodyThemeClass(true);
              setCurrentVersion(input.version);
            }
            return;
          }
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
      if (!input.silent) {
        setError(e instanceof Error ? e : new Error("Unknown error"));
        setIsLoading(false);
      }
      throw e;
    } finally {
      if (requestSeq.current !== seq) return;
      if (!input.silent) setIsLoading(false);
    }
  }, []);
  const refreshVersions = useCallback(async (): Promise<void> => {
    const [server, local] = await Promise.all([
      fetchJson<{ versions: VersionInfo[] }>("/api/user-theme/versions").catch(() => ({ versions: [] as VersionInfo[] })),
      cssCache.getAllVersions().catch(() => [])
    ]);
    const serverVersionIds = (server.versions ?? []).map((v) => v.version);
    const merged = Array.from(new Set([...serverVersionIds, ...local])).filter((v) => typeof v === "string" && v.length > 0);
    merged.sort();
    setAvailableVersions(merged);
    setVersionDetails(server.versions ?? []);
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
    const ssrCss = getSsrStyleCss(userInfo.userThemeVersion);
    const ssrHashOk = !!ssrCss && (!userInfo.userThemeHash || computeSha256Hex(ssrCss) === userInfo.userThemeHash);
    await applyVersion({
      version: userInfo.userThemeVersion,
      expectedHash: userInfo.userThemeHash,
      cssUrl: userInfo.userCSSUrl,
      preferSsr: true,
      silent: ssrHashOk,
    });
  }, [applyVersion, refreshVersions]);

  useEffect(() => {
    if (props.ssrApplied && props.initialVersion) {
      const css = getSsrStyleCss(props.initialVersion);
      if (css) {
        const hash = computeSha256Hex(css);
        const record: UserCssRecord = {
          version: props.initialVersion,
          css,
          hash,
          createdAt: Date.now(),
        };
        void cssCache.setCss(record);
        void cssCache.setCurrentVersion(props.initialVersion);
        setBodyThemeClass(true);
        setCurrentVersion(props.initialVersion);
        void refreshVersions();
        return;
      }
    }
    void refreshTheme();
  }, [props.initialVersion, props.ssrApplied, refreshTheme, refreshVersions]);
  const switchTheme = useCallback(async (version: string): Promise<void> => {
    const trimmed = version.trim();
    if (trimmed.length === 0) return;
    // 先保存旧版本 ID；等新主题 apply 成功后再移除旧 style，
    // 避免 apply 失败时页面丢失所有用户样式
    const prevVersion = currentVersion;
    await applyVersion({ version: trimmed });
    if (prevVersion && prevVersion !== trimmed) {
      removeStyle(`uth-${prevVersion}`);
    }

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
  const deleteVersion = useCallback(async (version: string): Promise<void> => {
    await fetchJson<{ success: boolean }>(`/api/user-theme/${encodeURIComponent(version)}`, { method: "DELETE" });
    await cssCache.deleteCss(version);
    if (currentVersion === version) {
      removeAllUserThemeStyles();
      setBodyThemeClass(false);
      setCurrentVersion(null);
      await cssCache.setCurrentVersion(null);
    }
    await refreshVersions();
  }, [currentVersion, refreshVersions]);
  const renameVersion = useCallback(async (version: string, newName: string): Promise<void> => {
    await fetchJson<{ success: boolean }>(`/api/user-theme/${encodeURIComponent(version)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionName: newName })
    });
    await refreshVersions();
  }, [refreshVersions]);
  const getThemeHistory = useCallback(async (): Promise<UserCssRecord[]> => {
    return await cssCache.getHistory();
  }, []);
  const value = useMemo<ThemeContextValue>(() => {
    return { currentVersion, availableVersions, versionDetails, isLoading, error, lastApplyTimeMs, switchTheme, revertToOfficial, refreshTheme, deleteVersion, renameVersion, getThemeHistory };
  }, [availableVersions, versionDetails, currentVersion, error, lastApplyTimeMs, getThemeHistory, isLoading, refreshTheme, revertToOfficial, switchTheme, deleteVersion, renameVersion]);
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

