"use client";

import { useState, useCallback, useTransition } from "react";
import { ProviderTab, PROVIDER_TABS_CONFIG } from "../hooks/useProviderTabs";

export function ProviderTabs({
  initialTab = "all-providers",
  onTabChange,
}: {
  initialTab?: ProviderTab;
  onTabChange?: (tab: ProviderTab) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProviderTab>(initialTab as ProviderTab);
  const [pendingTab, setPendingTab] = useState<ProviderTab | null>(null);
  const [, startTransition] = useTransition();

  const handleTabChange = useCallback(
    (tab: ProviderTab) => {
      if (tab === activeTab) return;
      setPendingTab(tab);
      startTransition(() => {
        setActiveTab(tab);
        onTabChange?.(tab);
        setTimeout(() => setPendingTab(null), 250);
      });
    },
    [activeTab, onTabChange]
  );

  return (
    <div className="border-b border-border mb-6">
      <nav className="flex gap-0 overflow-x-auto" aria-label="Provider tabs">
        {PROVIDER_TABS_CONFIG.map((tabConfig) => {
          const isActive = tabConfig.id === activeTab;
          const isLoading = pendingTab === tabConfig.id;
          return (
            <button
              key={tabConfig.id}
              type="button"
              onClick={() => handleTabChange(tabConfig.id)}
              aria-selected={isActive}
              role="tab"
              className={[
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap",
                "border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-text-main"
                  : "border-transparent text-text-muted hover:text-text-main hover:border-border",
              ].join(" ")}
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>
                {isLoading ? "progress_activity" : tabConfig.icon}
              </span>
              {tabConfig.fallback}
            </button>
          );
        })}
      </nav>
    </div>
  );
}