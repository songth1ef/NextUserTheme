import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ThemePreview } from "@/components/ThemePreview";

export default function HomePage() {
  return (
    <main className="page-container">
      <header className="page-header">
        <h1 className="page-title">Next 用户主题系统</h1>
        <p className="page-desc">
          SSR 首屏内联用户 CSS（无 FOUC），CSR 支持 IndexedDB 缓存热切换、多版本管理与回退。
        </p>
      </header>
      <ThemeSwitcher />
      <ThemePreview />
    </main>
  );
}
