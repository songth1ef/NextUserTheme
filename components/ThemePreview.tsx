"use client";

import React from "react";

export function ThemePreview() {
  return (
    <section className="section-grid">
      <h2 className="section-title">主题预览</h2>

      {/* 按钮组 */}
      <div className="panel">
        <h3 className="sub-title">按钮</h3>
        <div className="preview-btn-group">
          <button className="theme-button-primary">主要按钮</button>
          <button className="theme-button-secondary">次要按钮</button>
          <button className="theme-button-outline">轮廓按钮</button>
        </div>
      </div>

      {/* 卡片组 */}
      <div className="panel">
        <h3 className="sub-title">卡片</h3>
        <div className="preview-card-grid">
          <div className="theme-card">
            <div className="theme-card-title">卡片标题</div>
            <div className="theme-card-body">这是一个示例卡片，使用主题变量来设置样式。</div>
          </div>
          <div className="theme-card">
            <div className="theme-card-title">另一个卡片</div>
            <div className="theme-card-body">切换主题后，这些卡片的颜色会随之改变。</div>
          </div>
        </div>
      </div>

      {/* 表单元素 */}
      <div className="panel">
        <h3 className="sub-title">表单元素</h3>
        <div className="preview-form-grid">
          <input type="text" placeholder="输入框示例" className="theme-input" />
          <textarea placeholder="文本域示例" rows={4} className="theme-textarea" />
          <select className="theme-select">
            <option value="">选择选项...</option>
            <option value="1">选项 1</option>
            <option value="2">选项 2</option>
            <option value="3">选项 3</option>
          </select>
        </div>
      </div>

      {/* 文本和链接 */}
      <div className="panel">
        <h3 className="sub-title">文本和链接</h3>
        <div className="text-demo">
          <p>
            这是一段普通文本，颜色使用 <code>var(--color-text)</code>。
          </p>
          <p className="text-muted">
            这是一段次要文本，颜色使用 <code>var(--color-muted)</code>。
          </p>
          <div className="link-group">
            <a href="#">主要链接</a>
            <a href="#" style={{ textDecoration: "underline" }}>带下划线的链接</a>
          </div>
        </div>
      </div>

      {/* 徽章和标签 */}
      <div className="panel">
        <h3 className="sub-title">徽章和标签</h3>
        <div className="badge-group">
          <span className="theme-badge theme-badge-fill">主要徽章</span>
          <span className="theme-badge theme-badge-surface">次要徽章</span>
          <span className="theme-badge theme-badge-ghost">信息徽章</span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="panel">
        <h3 className="sub-title">进度条</h3>
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
