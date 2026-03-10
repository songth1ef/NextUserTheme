"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";

export function LocaleSwitcher() {
  const { t, activePackId, activePackName, availablePacks, switchPack } = useI18n();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    void switchPack(value === "" ? null : value);
  };

  return (
    <div className="status-bar" style={{ marginTop: 4 }}>
      <span className="status-badge">
        <strong>{t("locale.switchLabel")}</strong>
        {activePackName}
      </span>
      <select
        className="form-select"
        value={activePackId ?? ""}
        onChange={onChange}
        style={{ minWidth: 180 }}
      >
        <option value="">{t("locale.builtinName")}</option>
        {availablePacks.map((pack) => (
          <option key={pack.id} value={pack.id}>{pack.name}</option>
        ))}
      </select>
    </div>
  );
}
