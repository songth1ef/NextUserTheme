"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fetchJson } from "@/lib/fetch-json";
import type { I18nKeyDefinition, UserLocalePack } from "@/lib/i18n-types";

export function LocaleManager() {
  const { t, activePackId, switchPack, refreshPacks } = useI18n();
  const [keys, setKeys] = useState<I18nKeyDefinition[]>([]);
  const [builtinTranslations, setBuiltinTranslations] = useState<Record<string, string>>({});
  const [userPack, setUserPack] = useState<UserLocalePack | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newPackName, setNewPackName] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [englishPreset, setEnglishPreset] = useState<Record<string, string> | null>(null);

  const categories = useMemo(() => {
    const set = new Set(keys.map((k) => k.category));
    return Array.from(set).sort();
  }, [keys]);

  const filteredKeys = useMemo(() => {
    if (!categoryFilter) return keys;
    return keys.filter((k) => k.category === categoryFilter);
  }, [keys, categoryFilter]);

  const loadKeys = useCallback(async () => {
    try {
      const [keysData, builtinData] = await Promise.all([
        fetchJson<{ keys: I18nKeyDefinition[] }>("/api/i18n/keys"),
        fetchJson<{ translations: Record<string, string> }>("/api/i18n/builtin"),
      ]);
      setKeys(keysData.keys ?? []);
      setBuiltinTranslations(builtinData.translations ?? {});
    } catch {
      // silent
    }
  }, []);

  const loadEnglishPreset = useCallback(async () => {
    try {
      const res = await fetch("/locales/en.json");
      if (res.ok) {
        const data = (await res.json()) as Record<string, string>;
        setEnglishPreset(data);
      }
    } catch {
      // silent
    }
  }, []);

  const loadUserPack = useCallback(async (packId: string) => {
    try {
      const data = await fetchJson<{ pack: UserLocalePack }>(`/api/user-i18n/packs/${encodeURIComponent(packId)}`);
      setUserPack(data.pack);
      setEditValues({ ...data.pack.translations });
    } catch {
      setUserPack(null);
      setEditValues({});
    }
  }, []);

  useEffect(() => {
    void loadKeys();
    void loadEnglishPreset();
  }, [loadKeys, loadEnglishPreset]);

  useEffect(() => {
    if (activePackId) {
      void loadUserPack(activePackId);
    } else {
      setUserPack(null);
      setEditValues({});
    }
  }, [activePackId, loadUserPack]);

  const onEditChange = (key: string, value: string): void => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async (): Promise<void> => {
    if (!activePackId || !userPack) return;
    const translations: Record<string, string> = {};
    for (const [key, value] of Object.entries(editValues)) {
      if (value.trim()) translations[key] = value;
    }
    try {
      await fetchJson<{ success: boolean }>(`/api/user-i18n/packs/${encodeURIComponent(activePackId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translations }),
      });
      await switchPack(activePackId);
      await loadUserPack(activePackId);
      setMessage(t("locale.manager.save") + " ✓");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      console.error("Failed to save translations:", e);
    }
  };

  const onCreatePack = async (): Promise<void> => {
    if (!newPackName.trim()) return;
    try {
      const data = await fetchJson<{ success: boolean; pack: UserLocalePack }>("/api/user-i18n/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPackName.trim() }),
      });
      setNewPackName("");
      await refreshPacks();
      await switchPack(data.pack.id);
    } catch (e) {
      console.error("Failed to create pack:", e);
    }
  };

  const onCreateFromEnglishPreset = async (): Promise<void> => {
    if (!englishPreset) return;
    try {
      const data = await fetchJson<{ success: boolean; pack: UserLocalePack }>("/api/user-i18n/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "English", translations: englishPreset }),
      });
      await refreshPacks();
      await switchPack(data.pack.id);
    } catch (e) {
      console.error("Failed to create English preset:", e);
    }
  };

  const onDeletePack = async (): Promise<void> => {
    if (!activePackId || !userPack) return;
    const confirmed = window.confirm(t("locale.manager.confirmDelete", { name: userPack.name }));
    if (!confirmed) return;
    try {
      await fetchJson<{ success: boolean }>(`/api/user-i18n/packs/${encodeURIComponent(activePackId)}`, {
        method: "DELETE",
      });
      await refreshPacks();
      await switchPack(null);
    } catch (e) {
      console.error("Failed to delete pack:", e);
    }
  };

  const onExportJson = (): void => {
    const data = JSON.stringify(editValues, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${userPack?.name ?? "translations"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const onImportJson = async (file: File | null): Promise<void> => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      const translations: Record<string, string> = {};
      let count = 0;
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") {
          translations[key] = value;
          count++;
        }
      }
      setEditValues((prev) => ({ ...prev, ...translations }));
      setMessage(t("locale.manager.importSuccess", { count }));
      setTimeout(() => setMessage(""), 3000);
    } catch {
      // silent
    }
  };

  return (
    <section className="section-grid">
      <h2 className="section-title">{t("locale.manager.title")}</h2>

      {/* 新建 + 预设 */}
      <div className="panel">
        <h3 className="panel-title">{t("locale.manager.create")}</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="form-input"
            type="text"
            placeholder={t("locale.manager.packNamePlaceholder")}
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void onCreatePack(); }}
            style={{ flex: 1, minWidth: 180, maxWidth: 280 }}
          />
          <button className="btn btn-primary" onClick={() => void onCreatePack()}>
            {t("locale.manager.create")}
          </button>
        </div>

        {/* 英文预设快捷按钮 */}
        {englishPreset ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{t("locale.manager.loadPreset")}</span>
            <button
              className="preset-chip"
              data-color="blue"
              onClick={() => void onCreateFromEnglishPreset()}
            >
              {t("locale.manager.presetEnglish")}
            </button>
          </div>
        ) : null}
      </div>

      {/* 无用户包时的提示 */}
      {!activePackId ? (
        <div className="panel">
          <p className="panel-hint">{t("locale.manager.noUserPack")}</p>
        </div>
      ) : null}

      {/* 翻译编辑器 */}
      {activePackId && userPack ? (
        <div className="panel">
          <h3 className="panel-title">{userPack.name}</h3>

          {/* 操作栏 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => void onSave()}>
              {t("locale.manager.save")}
            </button>
            <button className="btn btn-sm" onClick={onExportJson}>
              {t("locale.manager.exportJson")}
            </button>
            <label className="btn btn-sm" style={{ cursor: "pointer" }}>
              {t("locale.manager.importJson")}
              <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => void onImportJson(e.target.files?.[0] ?? null)} />
            </label>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" style={{ color: "var(--color-danger)" }} onClick={() => void onDeletePack()}>
                {t("locale.manager.delete")}
              </button>
            </div>
          </div>

          {/* 反馈消息 */}
          {message ? (
            <div className="msg msg-success">
              <strong>{message}</strong>
            </div>
          ) : null}

          {/* 分类筛选 */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{t("locale.manager.category")}</label>
            <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">{t("locale.manager.all")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: "auto" }}>
              {filteredKeys.length} keys
            </span>
          </div>

          {/* 翻译表格 */}
          <div style={{ overflowX: "auto", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" }}>
                    {t("locale.manager.key")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" }}>
                    {t("locale.manager.builtinValue")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap", minWidth: 220 }}>
                    {t("locale.manager.userValue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((keyDef, idx) => {
                  const builtinVal = builtinTranslations[keyDef.key] ?? "";
                  const userVal = editValues[keyDef.key] ?? "";
                  const hasVariable = builtinVal.includes("{");
                  const isEven = idx % 2 === 0;
                  return (
                    <tr key={keyDef.key} style={{ background: isEven ? "transparent" : "rgba(255, 255, 255, 0.015)" }}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                        <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-primary)", lineHeight: 1.4 }}>
                          {keyDef.key}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2, lineHeight: 1.3 }}>
                          {keyDef.description}
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)", verticalAlign: "top", maxWidth: 260 }}>
                        <span style={{ fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>{builtinVal}</span>
                        {hasVariable ? (
                          <div style={{ fontSize: 10, color: "var(--color-warning, #f59e0b)", marginTop: 3 }}>
                            {builtinVal.match(/\{(\w+)\}/g)?.join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                        <input
                          className="form-input"
                          type="text"
                          value={userVal}
                          onChange={(e) => onEditChange(keyDef.key, e.target.value)}
                          placeholder={builtinVal}
                          style={{ width: "100%", padding: "6px 10px", fontSize: 12 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
