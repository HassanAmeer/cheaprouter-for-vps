import { SectionI18nProvider } from "@/i18n/SectionI18nProvider";
import sectionNamespaces from "@/i18n/routeNamespaces.generated.json";

/**
 * Dashboard home route (`/home`) i18n provider — provides the "home" namespace
 * for HomePageClient and companion components when accessed via /home.
 */
export default function HomeRouteLayout({ children }: { children: React.ReactNode }) {
  return <SectionI18nProvider namespaces={sectionNamespaces.home}>{children}</SectionI18nProvider>;
}
