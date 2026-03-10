"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";

export function PageHeader() {
  const { t } = useI18n();
  return (
    <header className="page-header">
      <h1 className="page-title">{t("page.title")}</h1>
      <p className="page-desc">{t("page.description")}</p>
    </header>
  );
}
