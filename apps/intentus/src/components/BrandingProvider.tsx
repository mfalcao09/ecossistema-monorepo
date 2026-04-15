import { useEffect } from "react";
import { usePlatformIdentity } from "@/hooks/usePlatformIdentity";

/**
 * BrandingProvider — handles dynamic favicon and page title from tenant settings.
 *
 * NOTE: Color CSS variable overrides (--primary, --ring, --sidebar-primary, etc.)
 * were REMOVED intentionally. The Cleopatra Neutral theme defined in index.css
 * is the single source of truth for all color tokens. Runtime setProperty() calls
 * were overriding the theme with database accent colors, breaking the design system.
 * See commit d816e155 for prior context on this same issue.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { identity, isLoading } = usePlatformIdentity();

  useEffect(() => {
    if (isLoading) return;

    // ── Favicon ──────────────────────────────────────────────────────────────
    if (identity.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = identity.favicon_url;
    }

    // ── Page title ───────────────────────────────────────────────────────────
    if (identity.platform_name) {
      document.title = identity.platform_name;
    }
  }, [identity, isLoading]);

  return <>{children}</>;
}
