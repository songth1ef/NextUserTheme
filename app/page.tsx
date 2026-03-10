import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ThemePreview } from "@/components/ThemePreview";
import { PageHeader } from "@/components/PageHeader";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LocaleManager } from "@/components/LocaleManager";

export default function HomePage() {
  return (
    <main className="page-container">
      <PageHeader />
      <LocaleSwitcher />
      <ThemeSwitcher />
      <ThemePreview />
      <LocaleManager />
    </main>
  );
}
