"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface SubmitThemeResponse {
  readonly success: boolean;
  readonly version?: string;
  readonly hash?: string;
  readonly cssUrl?: string;
  readonly errors?: ReadonlyArray<{ readonly type: string; readonly message: string; readonly line?: number; readonly column?: number }>;
}

type SubmitErrors = ReadonlyArray<{ readonly type: string; readonly message: string; readonly line?: number; readonly column?: number }> | null;

const exampleCss = `:root {
  --color-primary: #ff4d4f;
}

.user-theme a {
  color: var(--color-primary);
}
`;

export function ThemeSwitcher() {
  const theme = useTheme();
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [source, setSource] = useState<"upload" | "ai">("ai");
  const [css, setCss] = useState<string>(exampleCss);
  const [submitErrors, setSubmitErrors] = useState<SubmitErrors>(null);
  const [submitResult, setSubmitResult] = useState<{ version: string; hash: string } | null>(null);
  const versions = useMemo(() => {
    return theme.availableVersions.slice().sort().reverse();
  }, [theme.availableVersions]);
  const onPickFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    const text = await file.text();
    setSource("upload");
    setCss(text);
  };
  const onSubmit = async (): Promise<void> => {
    setSubmitErrors(null);
    setSubmitResult(null);
    const res = await fetch("/api/user-theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ css, source })
    });
    const json = (await res.json().catch(() => null)) as SubmitThemeResponse | null;
    if (!json) {
      setSubmitErrors([{ type: "other", message: `提交失败：${res.status}` }]);
      return;
    }
    if (!res.ok || !json.success) {
      setSubmitErrors(json.errors ?? [{ type: "other", message: `提交失败：${res.status}` }]);
      return;
    }
    setSubmitResult({ version: json.version ?? "", hash: json.hash ?? "" });
    await theme.refreshTheme();
  };
  const onSwitch = async (): Promise<void> => {
    const v = selectedVersion.trim();
    if (!v) return;
    await theme.switchTheme(v);
  };
  return (
    <section style={{ marginTop: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span className="badge">
          <strong>当前主题</strong>
          <span style={{ opacity: 0.8 }}>{theme.currentVersion ?? "官方主题"}</span>
        </span>
        <span style={{ opacity: 0.7 }}>{theme.isLoading ? "加载中…" : "就绪"}</span>
        <button onClick={() => void theme.refreshTheme()} style={{ padding: "8px 10px" }}>刷新</button>
        <button onClick={() => theme.revertToOfficial()} style={{ padding: "8px 10px" }}>回退官方</button>
      </div>
      {theme.error ? (
        <div style={{ border: "1px solid rgba(255,255,255,.12)", padding: 12, borderRadius: 12, background: "rgba(255,0,0,.08)" }}>
          <strong>错误</strong>
          <div style={{ marginTop: 6, opacity: 0.9, whiteSpace: "pre-wrap" }}>{theme.error.message}</div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 10, border: "1px solid rgba(255,255,255,.12)", padding: 12, borderRadius: 12 }}>
        <strong>版本切换</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} style={{ padding: 8, minWidth: 320 }}>
            <option value="">选择版本…</option>
            {versions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button onClick={() => void onSwitch()} style={{ padding: "8px 10px" }}>切换</button>
        </div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>优先 IndexedDB 命中，未命中才请求网络。</div>
      </div>
      <div style={{ display: "grid", gap: 10, border: "1px solid rgba(255,255,255,.12)", padding: 12, borderRadius: 12 }}>
        <strong>提交自定义 CSS</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="source" checked={source === "ai"} onChange={() => setSource("ai")} />
            AI 生成
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="source" checked={source === "upload"} onChange={() => setSource("upload")} />
            上传文件
          </label>
          <input type="file" accept=".css,text/css" onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => void onSubmit()} style={{ padding: "8px 10px" }}>提交并应用</button>
        </div>
        <textarea value={css} onChange={(e) => setCss(e.target.value)} rows={10} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", color: "inherit", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }} />
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          只允许 <code>:root</code> 与 <code>.user-theme</code> 作用域；禁止 <code>@import</code>、<code>@font-face</code>、<code>position: fixed</code>、<code>z-index &gt; 1000</code>、<code>url()</code> 等。
        </div>
        {submitResult ? (
          <div style={{ border: "1px solid rgba(255,255,255,.12)", padding: 10, borderRadius: 12, background: "rgba(0,255,0,.06)" }}>
            <strong>提交成功</strong>
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>version: {submitResult.version}</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>hash: {submitResult.hash}</div>
          </div>
        ) : null}
        {submitErrors && submitErrors.length > 0 ? (
          <div style={{ border: "1px solid rgba(255,255,255,.12)", padding: 10, borderRadius: 12, background: "rgba(255,0,0,.08)" }}>
            <strong>校验失败</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {submitErrors.map((e, idx) => (
                <li key={idx} style={{ opacity: 0.9 }}>
                  <code>{e.type}</code>：{e.message}{typeof e.line === "number" ? ` (${e.line}:${e.column ?? 0})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

