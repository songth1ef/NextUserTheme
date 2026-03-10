"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";

export function ThemePreview() {
  const { t } = useI18n();
  return (
    <section className="section-grid">
      <h2 className="section-title">{t("preview.title")}</h2>

      {/* 按钮组 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.buttons")}</h3>
        <div className="preview-btn-group">
          <button className="theme-button-primary">{t("preview.primaryButton")}</button>
          <button className="theme-button-secondary">{t("preview.secondaryButton")}</button>
          <button className="theme-button-outline">{t("preview.outlineButton")}</button>
        </div>
      </div>

      {/* 卡片组 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.cards")}</h3>
        <div className="preview-card-grid">
          <div className="theme-card">
            <div className="theme-card-title">{t("preview.cardTitle")}</div>
            <div className="theme-card-body">{t("preview.cardBody")}</div>
          </div>
          <div className="theme-card">
            <div className="theme-card-title">{t("preview.cardTitle2")}</div>
            <div className="theme-card-body">{t("preview.cardBody2")}</div>
          </div>
        </div>
      </div>

      {/* 表单元素 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.formElements")}</h3>
        <div className="preview-form-grid">
          <input type="text" placeholder={t("preview.inputPlaceholder")} className="theme-input" />
          <textarea placeholder={t("preview.textareaPlaceholder")} rows={4} className="theme-textarea" />
          <select className="theme-select">
            <option value="">{t("preview.selectPlaceholder")}</option>
            <option value="1">{t("preview.option1")}</option>
            <option value="2">{t("preview.option2")}</option>
            <option value="3">{t("preview.option3")}</option>
          </select>
        </div>
      </div>

      {/* 文本和链接 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.textAndLinks")}</h3>
        <div className="text-demo">
          <p>{t("preview.normalText")}</p>
          <p className="text-muted">{t("preview.mutedText")}</p>
          <div className="link-group">
            <a href="#">{t("preview.primaryLink")}</a>
            <a href="#" style={{ textDecoration: "underline" }}>{t("preview.underlineLink")}</a>
          </div>
        </div>
      </div>

      {/* 徽章和标签 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.badgesAndTags")}</h3>
        <div className="badge-group">
          <span className="theme-badge theme-badge-fill">{t("preview.primaryBadge")}</span>
          <span className="theme-badge theme-badge-surface">{t("preview.secondaryBadge")}</span>
          <span className="theme-badge theme-badge-ghost">{t("preview.infoBadge")}</span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="panel">
        <h3 className="sub-title">{t("preview.progressBar")}</h3>
        <div className="progress-group">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: "60%" }} />
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: "80%" }} />
          </div>
        </div>
      </div>
    </section>
  );
}
