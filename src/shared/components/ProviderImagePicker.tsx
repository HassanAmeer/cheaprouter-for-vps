"use client";

import React, { useState, useEffect, useMemo } from "react";
import { isValidProviderIconUrl } from "@/shared/validation/iconUrl";

interface IconItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

interface ProviderImagePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  className?: string;
}

export default function ProviderImagePicker({
  value,
  onChange,
  label = "Provider Icon",
  hint = "Select an icon from local storage or paste a custom image URL",
  className = "",
}: ProviderImagePickerProps) {
  const [activeTab, setActiveTab] = useState<"storage" | "custom">(() =>
    value && !value.startsWith("/storage") && !value.startsWith("/providers") ? "custom" : "storage"
  );
  const [icons, setIcons] = useState<IconItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrl, setCustomUrl] = useState(value || "");
  const [customImageError, setCustomImageError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch icons on mount
  useEffect(() => {
    let active = true;
    const fetchIcons = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/storage/provider-icons");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (active && Array.isArray(data.icons)) {
          setIcons(data.icons);
        }
      } catch {
        // Fallback silently if needed
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchIcons();
    return () => {
      active = false;
    };
  }, []);

  // Synchronize internal customUrl if external value changes
  useEffect(() => {
    setCustomUrl(value || "");
    setCustomImageError(false);
  }, [value]);

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return icons;
    const q = searchQuery.toLowerCase().trim();
    return icons.filter(
      (icon) => icon.name.toLowerCase().includes(q) || icon.id.toLowerCase().includes(q)
    );
  }, [icons, searchQuery]);

  const handleSelectIcon = (url: string) => {
    onChange(url);
    setCustomUrl(url);
    setCustomImageError(false);
  };

  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUrl = e.target.value;
    setCustomUrl(nextUrl);
    setCustomImageError(false);
    onChange(nextUrl);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setCustomUrl("");
    setCustomImageError(false);
  };

  const isUrlValid = useMemo(() => {
    if (!customUrl.trim()) return true;
    return isValidProviderIconUrl(customUrl);
  }, [customUrl]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/90">{label}</label>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-red-400/80 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">clear</span>
              Remove Icon
            </button>
          )}
        </div>
      )}

      {/* Selected Icon Trigger / Summary Banner */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#161616] p-2.5 transition-all hover:border-white/20 hover:bg-[#1A1A1A] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 p-1.5 overflow-hidden">
            {value ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={value}
                alt="Selected provider logo"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className="material-symbols-outlined text-lg text-white/40">
                image
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate">
                {value ? (
                  value.startsWith("/storage") || value.startsWith("/providers") ? (
                    value.split("/").pop()?.replace(/\.[^/.]+$/, "").toUpperCase()
                  ) : (
                    "Custom Remote URL"
                  )
                ) : (
                  "Default Generic Icon"
                )}
              </span>
              {value && (
                <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 text-[9px] font-mono">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 truncate font-mono">
              {value || "No custom image selected. Click to browse storage or enter URL."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-white/50 group-hover:text-white">
          <span className="text-xs">{isOpen ? "Close" : "Change"}</span>
          <span
            className={`material-symbols-outlined text-base transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Accordion Picker Content */}
      {isOpen && (
        <div className="mt-1 flex flex-col gap-3 rounded-xl border border-white/15 bg-[#121212] p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Tab Selector */}
          <div className="flex rounded-lg bg-black/40 p-1 border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("storage")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "storage"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">photo_library</span>
              From Storage ({icons.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "custom"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">link</span>
              Custom Image URL
            </button>
          </div>

          {/* Tab 1: Storage Library Grid */}
          {activeTab === "storage" && (
            <div className="flex flex-col gap-2.5">
              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter 140+ provider images (e.g. OpenAI, Claude, DeepSeek)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Scrollable Grid of Icons */}
              <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-4 sm:grid-cols-6 gap-2 custom-scrollbar">
                {loading ? (
                  <div className="col-span-full py-8 text-center text-xs text-white/40 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    Loading icons from storage...
                  </div>
                ) : filteredIcons.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-white/40">
                    No images match &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  filteredIcons.map((icon) => {
                    const isSelected = value === icon.url;
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => handleSelectIcon(icon.url)}
                        title={icon.name}
                        className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                        }`}
                      >
                        <div className="h-7 w-7 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={icon.url}
                            alt={icon.name}
                            loading="lazy"
                            className="h-full w-full object-contain filter group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <span className="text-[10px] text-white/70 group-hover:text-white truncate max-w-full text-center">
                          {icon.name}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined absolute top-1 right-1 text-xs text-emerald-400">
                            check_circle
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Custom URL Input */}
          {activeTab === "custom" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <input
                  type="url"
                  placeholder="https://example.com/logo.png or Google Image link"
                  value={customUrl}
                  onChange={handleCustomUrlChange}
                  className={`w-full rounded-lg border py-2 px-3 text-xs text-white placeholder-white/30 focus:outline-none ${
                    !isUrlValid
                      ? "border-red-500 bg-red-500/5 focus:border-red-500"
                      : "border-white/10 bg-black/30 focus:border-white/30"
                  }`}
                />
                {!isUrlValid && (
                  <span className="text-[11px] text-red-400">
                    Please enter a valid HTTP/HTTPS image URL or data URL
                  </span>
                )}
              </div>

              {/* URL Preview */}
              {customUrl && isUrlValid && (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="h-10 w-10 shrink-0 rounded border border-white/10 bg-black/40 p-1 flex items-center justify-center">
                    {!customImageError ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={customUrl}
                        alt="URL Preview"
                        className="h-full w-full object-contain"
                        onError={() => setCustomImageError(true)}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-sm text-red-400">
                        broken_image
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white font-medium">
                      {customImageError ? "Image failed to load" : "Remote Preview"}
                    </span>
                    <p className="text-[10px] text-white/50 truncate font-mono">
                      {customUrl}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hint && <p className="text-[11px] text-white/50">{hint}</p>}
    </div>
  );
}
