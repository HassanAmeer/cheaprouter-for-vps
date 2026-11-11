"use client";

/**
 * Compact index of the provider type sections.
 *
 * The "All Providers" view used to render ~18 full sections back to back —
 * each with its own header, description and card grid — while a row of 15
 * auth-type chips above it offered the SAME grouping a second time (with
 * different numbers). The page was a scroll marathon with a duplicated
 * taxonomy.
 *
 * This index replaces both: one row per type, with the count that the section
 * itself shows. Picking a row opens exactly that section; "All types" in the
 * toolbar comes back to the index.
 */

export interface ProviderSectionIndexItem {
  /** Filter key used by the page (matches `activeCategory`). */
  key: string;
  label: string;
  description: string;
  /** Tailwind background class of the type dot. */
  dotColor: string;
  /** Material Symbols icon. */
  icon: string;
  configured: number;
  total: number;
}

export function ProviderSectionIndex({
  items,
  onSelect,
}: {
  items: ProviderSectionIndexItem[];
  onSelect: (key: string) => void;
}) {
  const visible = items.filter((item) => item.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="provider-section-index">
      {visible.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className="group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-border bg-bg-primary hover:border-primary/40 hover:bg-bg-subtle/60 transition-colors"
        >
          <span
            className={`size-2.5 rounded-full shrink-0 ${item.dotColor}`}
            aria-hidden="true"
            title={item.label}
          />
          <span className="material-symbols-outlined text-[18px] text-text-muted shrink-0">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-text-main truncate">
                {item.label}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-bg-subtle text-text-muted border border-border">
                {item.configured}/{item.total}
              </span>
            </span>
            <span className="block text-xs text-text-muted truncate">{item.description}</span>
          </span>
          <span className="material-symbols-outlined text-[18px] text-text-muted/60 group-hover:text-text-muted transition-colors shrink-0">
            expand_more
          </span>
        </button>
      ))}
    </div>
  );
}

export default ProviderSectionIndex;
