"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useI18n } from "@/components/I18nProvider";

interface SubmitThemeResponse {
  readonly success: boolean;
  readonly version?: string;
  readonly hash?: string;
  readonly cssUrl?: string;
  readonly errors?: ReadonlyArray<{ readonly type: string; readonly message: string; readonly line?: number; readonly column?: number }>;
}

type SubmitErrors = ReadonlyArray<{ readonly type: string; readonly message: string; readonly line?: number; readonly column?: number }> | null;

const exampleCss = `:root {
  /* 主题色：红色系 */
  --color-primary: #ff4d4f;
  --color-surface: #1a1a2e;
  --color-border: rgba(255, 77, 79, 0.3);
}

/* 按钮样式 */
.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
  transition: all 0.2s;
}

.user-theme .theme-button-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 77, 79, 0.4);
}

.user-theme .theme-button-outline {
  border-color: var(--color-primary) !important;
  color: var(--color-primary) !important;
}

.user-theme .theme-button-outline:hover {
  background: var(--color-primary) !important;
  color: #fff !important;
}

/* 卡片样式 */
.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
  transition: all 0.2s;
}

.user-theme .theme-card:hover {
  border-color: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.1);
}

/* 表单元素 */
.user-theme .theme-input:focus,
.user-theme .theme-textarea:focus,
.user-theme .theme-select:focus {
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.1);
}

/* 链接 */
.user-theme a {
  color: var(--color-primary);
  transition: opacity 0.2s;
}

.user-theme a:hover {
  opacity: 0.8;
}

/* 徽章 */
.user-theme .theme-badge {
  background: var(--color-primary) !important;
}
`;

const presetCss = {
  green: `:root {
  --color-primary: #10b981;
  --color-surface: #064e3b;
  --color-border: rgba(16, 185, 129, 0.3);
}

.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
}

.user-theme a {
  color: var(--color-primary);
}`,
  purple: `:root {
  --color-primary: #8b5cf6;
  --color-surface: #3b1f5e;
  --color-border: rgba(139, 92, 246, 0.3);
}

.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
}

.user-theme a {
  color: var(--color-primary);
}`,
  orange: `:root {
  --color-primary: #f59e0b;
  --color-surface: #78350f;
  --color-border: rgba(245, 158, 11, 0.3);
}

.user-theme .theme-button-primary {
  background: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.user-theme .theme-card {
  border-color: var(--color-border) !important;
  background: var(--color-surface) !important;
}

.user-theme a {
  color: var(--color-primary);
}`,
  red: exampleCss,
};

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function ThemeSwitcher() {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [source, setSource] = useState<"upload" | "ai">("ai");
  const [css, setCss] = useState<string>(exampleCss);
  const [versionName, setVersionName] = useState<string>("");
  const [submitErrors, setSubmitErrors] = useState<SubmitErrors>(null);
  const [submitResult, setSubmitResult] = useState<{ version: string; hash: string } | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const versions = useMemo(() => {
    return theme.versionDetails.slice().sort((a, b) => b.createdAt - a.createdAt);
  }, [theme.versionDetails]);

  const presets = useMemo(() => [
    { label: t("theme.presetGreen"), color: "green" as const, css: presetCss.green },
    { label: t("theme.presetPurple"), color: "purple" as const, css: presetCss.purple },
    { label: t("theme.presetOrange"), color: "orange" as const, css: presetCss.orange },
    { label: t("theme.presetRed"), color: "red" as const, css: presetCss.red },
  ], [t]);

  const onPickFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    const text = await file.text();
    setSource("upload");
    setCss(text);
  };

  const onSubmit = async (): Promise<void> => {
    if (!versionName.trim()) {
      setSubmitErrors([{ type: "validation", message: t("theme.versionNameRequired") }]);
      return;
    }
    setSubmitErrors(null);
    setSubmitResult(null);
    const res = await fetch("/api/user-theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ css, source, versionName: versionName.trim() })
    });
    const json = (await res.json().catch(() => null)) as SubmitThemeResponse | null;
    if (!json) {
      setSubmitErrors([{ type: "other", message: t("theme.submitFailed", { status: String(res.status) }) }]);
      return;
    }
    if (!res.ok || !json.success) {
      setSubmitErrors(json.errors ?? [{ type: "other", message: t("theme.submitFailed", { status: String(res.status) }) }]);
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

  const onDelete = async (version: string): Promise<void> => {
    await theme.deleteVersion(version);
  };

  const onRenameStart = (version: string, currentName: string): void => {
    setEditingVersion(version);
    setEditingName(currentName);
  };

  const onRenameConfirm = async (): Promise<void> => {
    if (!editingVersion || !editingName.trim()) return;
    await theme.renameVersion(editingVersion, editingName.trim());
    setEditingVersion(null);
    setEditingName("");
  };

  const onRenameCancel = (): void => {
    setEditingVersion(null);
    setEditingName("");
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {/* 状态栏 */}
      <div className="status-bar">
        <span className="status-badge">
          <strong>{t("theme.currentTheme")}</strong>
          {theme.currentVersion ?? t("theme.officialTheme")}
        </span>
        {theme.lastApplyTimeMs !== null ? (
          <span className="status-badge" style={{ background: "rgba(52,211,153,0.1)", color: "var(--color-success)", borderColor: "rgba(52,211,153,0.15)" }}>
            {theme.lastApplyTimeMs} ms
          </span>
        ) : null}
        <span className="status-text">{theme.isLoading ? t("theme.loading") : t("theme.ready")}</span>
        <button className="btn btn-sm" onClick={() => void theme.refreshTheme()}>{t("theme.refresh")}</button>
        <button className="btn btn-sm" onClick={() => void theme.revertToOfficial()}>{t("theme.revertOfficial")}</button>
      </div>

      {/* 错误提示 */}
      {theme.error ? (
        <div className="msg msg-error">
          <strong>{t("theme.error")}</strong>
          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{theme.error.message}</div>
        </div>
      ) : null}

      {/* 版本管理 */}
      <div className="panel">
        <h3 className="panel-title">{t("theme.versionManagement")}</h3>

        {/* 快捷切换 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select className="form-select" value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
            <option value="">{t("theme.selectVersion")}</option>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>{v.versionName} ({v.version.slice(-12)})</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => void onSwitch()}>{t("theme.switch")}</button>
        </div>

        {/* 版本列表 */}
        {versions.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {versions.map((v) => (
              <div
                key={v.version}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: theme.currentVersion === v.version ? "rgba(106,168,255,0.06)" : "transparent",
                  flexWrap: "wrap"
                }}
              >
                {/* 名称 */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  {editingVersion === v.version ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="form-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void onRenameConfirm();
                          if (e.key === "Escape") onRenameCancel();
                        }}
                        style={{ padding: "4px 8px", fontSize: 13, width: 160 }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => void onRenameConfirm()}>{t("theme.confirm")}</button>
                      <button className="btn btn-sm" onClick={onRenameCancel}>{t("theme.cancel")}</button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {v.versionName}
                      {theme.currentVersion === v.version ? (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-primary)", opacity: 0.8 }}>({t("theme.current")})</span>
                      ) : null}
                    </span>
                  )}
                </div>
                {/* 元信息 */}
                <span style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace" }}>
                  {v.version.slice(-12)}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                  {formatTime(v.createdAt)}
                </span>
                {/* 操作 */}
                {editingVersion !== v.version ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => void theme.switchTheme(v.version)}>{t("theme.apply")}</button>
                    <button className="btn btn-sm" onClick={() => onRenameStart(v.version, v.versionName)}>{t("theme.rename")}</button>
                    <button className="btn btn-sm" style={{ color: "var(--color-danger)" }} onClick={() => void onDelete(v.version)}>{t("theme.delete")}</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="panel-hint">{t("theme.noVersions")}</p>
        )}

        <p className="panel-hint">{t("theme.cacheHint")}</p>
      </div>

      {/* 提交自定义 CSS */}
      <div className="panel">
        <h3 className="panel-title">{t("theme.submitCSS")}</h3>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" name="source" checked={source === "ai"} onChange={() => setSource("ai")} />
              {t("theme.aiGenerated")}
            </label>
            <label className="radio-label">
              <input type="radio" name="source" checked={source === "upload"} onChange={() => setSource("upload")} />
              {t("theme.uploadFile")}
            </label>
          </div>
          <input className="form-file" type="file" accept=".css,text/css" onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* 版本名称 */}
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            {t("theme.versionName")} <span style={{ color: "var(--color-danger, #f87171)" }}>*</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder={t("theme.versionNamePlaceholder")}
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* 预设主题 */}
        <div className="preset-group">
          {presets.map((p) => (
            <button
              key={p.color}
              className="preset-chip"
              data-color={p.color}
              onClick={() => { setCss(p.css); setSource("ai"); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          className="form-textarea"
          value={css}
          onChange={(e) => setCss(e.target.value)}
          rows={12}
          style={{ width: "100%" }}
        />

        <p className="panel-hint">
          {t("theme.cssConstraint")}
        </p>

        <button className="btn btn-primary" onClick={() => void onSubmit()}>{t("theme.submitAndApply")}</button>

        {submitResult ? (
          <div className="msg msg-success">
            <strong>{t("theme.submitSuccess")}</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>version: {submitResult.version}</div>
            <div style={{ fontSize: 13 }}>hash: {submitResult.hash}</div>
          </div>
        ) : null}

        {submitErrors && submitErrors.length > 0 ? (
          <div className="msg msg-error">
            <strong>{t("theme.validationFailed")}</strong>
            <ul>
              {submitErrors.map((e, idx) => (
                <li key={idx}>
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
