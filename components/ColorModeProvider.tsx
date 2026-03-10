"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ColorMode } from "@/lib/types";

interface ColorModeContextValue {
  readonly colorMode: ColorMode;
  readonly resolvedMode: "light" | "dark";
  readonly setColorMode: (mode: ColorMode) => Promise<void>;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  colorMode: "dark",
  resolvedMode: "dark",
  setColorMode: async () => {},
});

interface ColorModeProviderProps {
  readonly children: React.ReactNode;
  readonly initialMode: ColorMode;
}

export function ColorModeProvider({ children, initialMode }: ColorModeProviderProps) {
  const [colorMode, setColorModeState] = useState<ColorMode>(initialMode);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
    if (initialMode !== "system") return initialMode;
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const mode = e.matches ? "dark" : "light";
      setResolvedMode(mode);
      document.documentElement.setAttribute("data-color-mode", mode);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorMode]);

  const setColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    setResolvedMode(resolved);
    document.documentElement.setAttribute("data-color-mode", resolved);

    await fetch("/api/color-mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  }, []);

  return (
    <ColorModeContext.Provider value={{ colorMode, resolvedMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
