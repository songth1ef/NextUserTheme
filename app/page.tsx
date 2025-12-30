import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Next 用户主题系统（Demo）</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        目标：SSR 首屏内联用户 CSS（无 FOUC），CSR 支持 IndexedDB 缓存热切换、多版本管理与回退。
      </p>
      <ThemeSwitcher />
    </main>
  );
}

