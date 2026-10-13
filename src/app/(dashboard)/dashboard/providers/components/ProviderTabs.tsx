"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { ProviderDisplayMode } from "../providerPageStorage";
import { ProviderTab, PROVIDER_TABS_CONFIG, tabToCategories } from "../hooks/useProviderTabs";
import { Button, Card } from "@/shared/components";
import { useTranslations } from "next-intl";

function StepPill({
  active,
  done,
  label,
  icon,
  onClick,
  className,
}: {
  active: boolean;
  done: boolean;
  label: string;
  icon: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className || `flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : done
            ? "border-success/30 bg-success/10 text-success"
            : "border-border bg-bg-subtle text-text-muted"}
      `}
    >
      <span className="material-symbols-outlined text-[14px]">
        {icon}
      </span>
      <span>
        {label}
      </span>
    </button>
  );
}

export function ProviderTabs({
  initialTab = "all",
  onTabChange,
  displayMode,
  setDisplayMode,
  searchQuery,
  setSearchQuery,
  modelSearchQuery,
  setModelSearchQuery,
  showFreeOnly,
  setShowFreeOnly,
  activeServiceKind,
  setActiveServiceKind,
}: {
  initialTab?: ProviderTab;
  onTabChange?: (tab: ProviderTab) => void;
  displayMode?: ProviderDisplayMode;
  setDisplayMode?: (mode: ProviderDisplayMode) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  modelSearchQuery?: string;
  setModelSearchQuery?: (q: string) => void;
  showFreeOnly?: boolean;
  setShowFreeOnly?: (v: boolean) => void;
  activeServiceKind?: string | null;
  setActiveServiceKind?: (k: string | null) => void;
}) {
  const t = useTranslations("providers");

  const [activeTab, setActiveTab] = useState<ProviderTab>(initialTab as ProviderTab);

  const handleTabChange = useCallback(
    (tab: ProviderTab) => {
      setActiveTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange]
  );

  return (
    <div className="border-b border-border mb-6">
      <div className="flex flex-wrap gap-2">
        {PROVIDER_TABS_CONFIG.map((tabConfig) => {
          const isActive = tabConfig.id === activeTab;
          return (
            <StepPill
              key={tabConfig.id}
              active={isActive}
              done={false}
              label={t(tabConfig.key) || tabConfig.fallback}
              icon={tabConfig.icon}
              onClick={() => handleTabChange(tabConfig.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-bg-subtle text-text-muted"}
              `}
            />
          );
        })}
      </div>
    </div>
  );
}