"use client";

import React from "react";

export function ThemePreview() {
  return (
    <section style={{ marginTop: 24, display: "grid", gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>主题预览</h2>
      
      {/* 按钮组 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>按钮</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="theme-button-primary"
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius, 8px)",
              border: "none",
              background: "var(--color-primary, #6aa8ff)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            主要按钮
          </button>
          <button
            className="theme-button-secondary"
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
              color: "var(--color-text, #e9ecff)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            次要按钮
          </button>
          <button
            className="theme-button-outline"
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius, 8px)",
              border: "2px solid var(--color-primary, #6aa8ff)",
              background: "transparent",
              color: "var(--color-primary, #6aa8ff)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-primary, #6aa8ff)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--color-primary, #6aa8ff)";
            }}
          >
            轮廓按钮
          </button>
        </div>
      </div>

      {/* 卡片组 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>卡片</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div
            className="theme-card"
            style={{
              padding: "var(--spacing, 16px)",
              borderRadius: "var(--radius, 12px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>卡片标题</div>
            <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
              这是一个示例卡片，使用主题变量来设置样式。
            </div>
          </div>
          <div
            className="theme-card"
            style={{
              padding: "var(--spacing, 16px)",
              borderRadius: "var(--radius, 12px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>另一个卡片</div>
            <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
              切换主题后，这些卡片的颜色会随之改变。
            </div>
          </div>
        </div>
      </div>

      {/* 输入框组 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>表单元素</h3>
        <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
          <input
            type="text"
            placeholder="输入框示例"
            className="theme-input"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
              color: "var(--color-text, #e9ecff)",
              fontSize: 14,
              outline: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-primary, #6aa8ff)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border, rgba(233,236,255,.12))";
            }}
          />
          <textarea
            placeholder="文本域示例"
            rows={4}
            className="theme-textarea"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
              color: "var(--color-text, #e9ecff)",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-primary, #6aa8ff)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border, rgba(233,236,255,.12))";
            }}
          />
          <select
            className="theme-select"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
              color: "var(--color-text, #e9ecff)",
              fontSize: 14,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">选择选项...</option>
            <option value="1">选项 1</option>
            <option value="2">选项 2</option>
            <option value="3">选项 3</option>
          </select>
        </div>
      </div>

      {/* 链接和文本 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>文本和链接</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "var(--color-text, #e9ecff)", lineHeight: 1.6 }}>
            这是一段普通文本，颜色使用 <code style={{ background: "rgba(255,255,255,.1)", padding: "2px 6px", borderRadius: 4 }}>var(--color-text)</code>。
          </p>
          <p style={{ margin: 0, color: "var(--color-muted, rgba(233,236,255,.72))", lineHeight: 1.6 }}>
            这是一段次要文本，颜色使用 <code style={{ background: "rgba(255,255,255,.1)", padding: "2px 6px", borderRadius: 4 }}>var(--color-muted)</code>。
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="#" style={{ color: "var(--color-primary, #6aa8ff)", textDecoration: "none" }}>
              主要链接
            </a>
            <a href="#" style={{ color: "var(--color-primary, #6aa8ff)", textDecoration: "underline" }}>
              带下划线的链接
            </a>
          </div>
        </div>
      </div>

      {/* 徽章和标签 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>徽章和标签</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            className="theme-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "var(--color-primary, #6aa8ff)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            主要徽章
          </span>
          <span
            className="theme-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              borderRadius: "999px",
              border: "1px solid var(--color-border, rgba(233,236,255,.12))",
              background: "var(--color-surface, #111a33)",
              color: "var(--color-text, #e9ecff)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            次要徽章
          </span>
          <span
            className="theme-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "rgba(106, 168, 255, 0.1)",
              color: "var(--color-primary, #6aa8ff)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            信息徽章
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>进度条</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ position: "relative", width: "100%", height: 8, background: "var(--color-surface, #111a33)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: "60%",
                height: "100%",
                background: "var(--color-primary, #6aa8ff)",
                borderRadius: 4,
                transition: "width 0.3s",
              }}
            />
          </div>
          <div style={{ position: "relative", width: "100%", height: 8, background: "var(--color-surface, #111a33)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: "80%",
                height: "100%",
                background: "var(--color-primary, #6aa8ff)",
                borderRadius: 4,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

