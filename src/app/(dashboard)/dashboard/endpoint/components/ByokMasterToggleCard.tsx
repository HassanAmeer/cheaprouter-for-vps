"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import { useTranslations } from "next-intl";

/**
 * BYOK master toggle (spec §3 Tab 5 / §7).
 *
 * Renders the operator's "Enable BYOK Providers" switch. When OFF,
 * every pass-through key (`x-upstream-key` / `x-claude-key` / …)
 * is rejected with 403 at the route gate and never injected
 * upstream. When ON, a caller's personal upstream key overrides
 * the operator's default key for that request.
 */
export default function ByokMasterToggleCard() {
  const t = useTranslations("endpoint");
  const [byokEnabled, setByokEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/v1/reseller/byok")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load BYOK setting");
        return res.json();
      })
      .then((data) => {
        setByokEnabled(data.byokEnabled !== false);
        setError(null);
      })
      .catch(() => {
        setError(t("byokSaveFailed"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = (checked: boolean) => {
    setSaving(true);
    setError(null);
    fetch("/api/v1/reseller/byok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ byokEnabled: checked }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save BYOK setting");
        return res.json();
      })
      .then((data) => {
        setByokEnabled(data.byokEnabled === true);
      })
      .catch(() => {
        setError(t("byokSaveFailed"));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-main">
            {t("byokTitle")}
          </h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {t("byokDesc")}
          </p>
          <p className="text-xs mt-2">
            <span
              className={
                byokEnabled ? "text-green-400" : "text-text-muted"
              }
            >
              {byokEnabled ? t("byokOnHint") : t("byokOffHint")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && (
            <span className="material-symbols-outlined text-[16px] animate-spin text-text-muted">
              progress_activity
            </span>
          )}
          <Toggle
            checked={byokEnabled}
            onChange={handleToggle}
            disabled={loading || saving}
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </Card>
  );
}
