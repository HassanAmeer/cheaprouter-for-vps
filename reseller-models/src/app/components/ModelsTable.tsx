"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicCombo, PublicProvider } from "@/lib/cheaproute";
import { generateCatalog } from "./modelsData";

export interface ModelLibraryItem {
  id: string;
  name: string;
  symbol: string;
  symbolBg?: string;
  modality: "text" | "image" | "audio" | "video" | "embeddings" | "decisions";
  weeklyTokens: string;
  inputPrice: string;
  inputOriginal?: string;
  inputDiscount?: string;
  outputPrice: string;
  outputOriginal?: string;
  outputDiscount?: string;
  context: string;
  contextNum: number;
  uptime: number; // percentage
  success: number; // percentage
  latency: string;
  released: string;
  isFree?: boolean;
  hasFunctionCalling?: boolean;
}

const SCREENSHOT_MODELS: ModelLibraryItem[] = [
  {
    id: "google/gemini-4-argon",
    name: "gemini-4-argon",
    symbol: "G",
    modality: "text",
    weeklyTokens: "209.2M",
    inputPrice: "$0.45",
    inputOriginal: "$2.00",
    inputDiscount: "78% off",
    outputPrice: "$2.25",
    outputOriginal: "$10.00",
    outputDiscount: "78% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 77.0,
    success: 98.1,
    latency: "16.69s",
    released: "Oct 13, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "meta/muse-wonder",
    name: "muse-wonder",
    symbol: "∞",
    modality: "image",
    weeklyTokens: "1.63M",
    inputPrice: "$8.00",
    outputPrice: "$40.00",
    context: "1.0M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 66.7,
    latency: "3.32s",
    released: "Oct 12, 2026",
    hasFunctionCalling: false,
  },
  {
    id: "step/step-5-preview",
    name: "step-5-preview",
    symbol: "🎵",
    modality: "text",
    weeklyTokens: "593K",
    inputPrice: "$2.00",
    outputPrice: "$5.40",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 100.0,
    latency: "1.16s",
    released: "Oct 8, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "anthropic/claude-haiku-5-5",
    name: "claude-haiku-5-5",
    symbol: "A\\",
    modality: "text",
    weeklyTokens: "1.80B",
    inputPrice: "$0.05",
    inputOriginal: "$0.10",
    inputDiscount: "50% off",
    outputPrice: "$0.25",
    outputOriginal: "$0.50",
    outputDiscount: "50% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 99.9,
    latency: "22.83s",
    released: "Oct 7, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "google/gemini-nano-banana-2-1",
    name: "gemini-nano-banana-2.1",
    symbol: "G",
    modality: "image",
    weeklyTokens: "1.83M",
    inputPrice: "-",
    outputPrice: "$0.02/img",
    outputOriginal: "$0.08/img",
    outputDiscount: "70% off",
    context: "65.5K",
    contextNum: 65500,
    uptime: 100.0,
    success: 68.8,
    latency: "30.19s",
    released: "Oct 6, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "mistral/mistral-large-4",
    name: "mistral-large-4",
    symbol: "M",
    modality: "text",
    weeklyTokens: "7.26M",
    inputPrice: "$1.36",
    outputPrice: "$4.08",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 33.3,
    latency: "4.27s",
    released: "Oct 6, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "ling/ling-3-1-flash-free",
    name: "ling-3.1-flash:free",
    symbol: "⏱",
    modality: "text",
    weeklyTokens: "500.8M",
    inputPrice: "-",
    outputPrice: "-",
    context: "262.1K",
    contextNum: 262100,
    uptime: 67.1,
    success: 81.1,
    latency: "2.76s",
    released: "Oct 2, 2026",
    isFree: true,
    hasFunctionCalling: true,
  },
  {
    id: "mercury/mercury-decide-free",
    name: "mercury-decide:free",
    symbol: "⏣",
    modality: "decisions",
    weeklyTokens: "1.34M",
    inputPrice: "-",
    outputPrice: "-",
    context: "32.8K",
    contextNum: 32800,
    uptime: 100.0,
    success: 40.0,
    latency: "1.28s",
    released: "Sep 30, 2026",
    isFree: true,
    hasFunctionCalling: false,
  },
  {
    id: "openai/gpt-6-1-sol",
    name: "gpt-6.1-sol",
    symbol: "✹",
    modality: "text",
    weeklyTokens: "1.57B",
    inputPrice: "$0.36",
    inputOriginal: "$2.00",
    inputDiscount: "82% off",
    outputPrice: "$1.79",
    outputOriginal: "$10.00",
    outputDiscount: "82% off",
    context: "1.1M",
    contextNum: 1100000,
    uptime: 100.0,
    success: 99.2,
    latency: "16.07s",
    released: "Sep 29, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "anthropic/claude-sonnet-5-5",
    name: "claude-sonnet-5-5",
    symbol: "A\\",
    modality: "text",
    weeklyTokens: "748.6M",
    inputPrice: "$0.50",
    inputOriginal: "$2.00",
    inputDiscount: "75% off",
    outputPrice: "$2.50",
    outputOriginal: "$10.00",
    outputDiscount: "75% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 99.9,
    latency: "8.27s",
    released: "Sep 28, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "openai/text-embedding-3-large",
    name: "text-embedding-3-large",
    symbol: "OI",
    modality: "embeddings",
    weeklyTokens: "320.4M",
    inputPrice: "$0.13",
    outputPrice: "-",
    context: "8K",
    contextNum: 8192,
    uptime: 100.0,
    success: 100.0,
    latency: "0.12s",
    released: "Sep 15, 2026",
    hasFunctionCalling: false,
  },
  {
    id: "openai/whisper-large-v3",
    name: "whisper-large-v3",
    symbol: "OI",
    modality: "audio",
    weeklyTokens: "84.2M",
    inputPrice: "$0.006/min",
    outputPrice: "-",
    context: "Audio",
    contextNum: 30000,
    uptime: 99.8,
    success: 99.7,
    latency: "1.85s",
    released: "Sep 10, 2026",
    hasFunctionCalling: false,
  },
];

interface ModelsTableProps {
  providers?: PublicProvider[];
  combos?: PublicCombo[];
}

export default function ModelsTable({ providers = [], combos = [] }: ModelsTableProps) {
  // Sidebar open/collapse state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Filters state
  const [modalities, setModalities] = useState<Record<string, boolean>>({
    Text: true,
    Image: true,
    File: false,
    Audio: true,
    Video: false,
  });
  const [functionCallingOnly, setFunctionCallingOnly] = useState(false);
  const [hideFree, setHideFree] = useState(false);
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [minContext, setMinContext] = useState(0);
  const [maxInputPrice, setMaxInputPrice] = useState<number>(0);
  const [maxOutputPrice, setMaxOutputPrice] = useState<number>(0);
  const [compareOnly, setCompareOnly] = useState(false);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Tab & Search state
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof ModelLibraryItem>("released");
  const [sortAsc, setSortAsc] = useState(false);

  const resetAllFilters = () => {
    setModalities({
      Text: true,
      Image: true,
      File: false,
      Audio: true,
      Video: false,
    });
    setFunctionCallingOnly(false);
    setHideFree(false);
    setDiscountedOnly(false);
    setMinContext(0);
    setMaxInputPrice(0);
    setMaxOutputPrice(0);
    setCompareOnly(false);
    setSearch("");
  };

  const hasActiveFilters = Boolean(
    !modalities.Text ||
    !modalities.Image ||
    modalities.File ||
    !modalities.Audio ||
    modalities.Video ||
    functionCallingOnly ||
    hideFree ||
    discountedOnly ||
    minContext > 0 ||
    maxInputPrice > 0 ||
    maxOutputPrice > 0 ||
    compareOnly ||
    search.trim()
  );

  // Pagination state — 100 models per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100;
  const [jumpInputTop, setJumpInputTop] = useState<string>("");
  const [jumpInputBottom, setJumpInputBottom] = useState<string>("");

  // Base 214 models catalog
  const catalogList = useMemo(() => generateCatalog(), []);

  // Combine static library with live catalog providers
  const modelsList: ModelLibraryItem[] = useMemo(() => {
    const list = [...catalogList];

    // Merge live combos from router if available
    for (const c of combos) {
      if (!c.name) continue;
      const isFree = c.pricing?.tier === "free" || (!c.pricing?.inputCost && !c.pricing?.outputCost);
      list.push({
        id: `combo/${c.name}`,
        name: c.displayName || c.name,
        symbol: "⚡",
        modality: "text",
        weeklyTokens: "12.4M",
        inputPrice: isFree ? "-" : `$${c.pricing?.inputCost ?? 0.5}`,
        outputPrice: isFree ? "-" : `$${c.pricing?.outputCost ?? 1.5}`,
        context: "128K",
        contextNum: 128000,
        uptime: 99.9,
        success: 99.8,
        latency: "0.45s",
        released: "Live Combo",
        isFree,
        hasFunctionCalling: true,
      });
    }

    return list;
  }, [catalogList, combos]);

  // Modality Counts (computed dynamically from modelsList)
  const counts = useMemo(() => {
    const res = {
      All: modelsList.length,
      Text: 0,
      Image: 0,
      Audio: 0,
      Video: 0,
      Embeddings: 0,
      Decisions: 0,
    };
    for (const m of modelsList) {
      if (m.modality === "text") res.Text++;
      else if (m.modality === "image") res.Image++;
      else if (m.modality === "audio") res.Audio++;
      else if (m.modality === "video") res.Video++;
      else if (m.modality === "embeddings") res.Embeddings++;
      else if (m.modality === "decisions") res.Decisions++;
    }
    return res;
  }, [modelsList]);

  // Filtered & Sorted items
  const filteredModels = useMemo(() => {
    return modelsList
      .filter((m) => {
        // Tab filter
        if (activeTab === "Text" && m.modality !== "text") return false;
        if (activeTab === "Image" && m.modality !== "image") return false;
        if (activeTab === "Audio" && m.modality !== "audio") return false;
        if (activeTab === "Video" && m.modality !== "video") return false;
        if (activeTab === "Embeddings" && m.modality !== "embeddings") return false;
        if (activeTab === "Decisions" && m.modality !== "decisions") return false;

        // Modalities sidebar checkbox filter (applies to the modalities covered in sidebar checkboxes)
        const sidebarChecklistModalities = ["text", "image", "file", "audio", "video"];
        if (sidebarChecklistModalities.includes(m.modality)) {
          const activeModalities = Object.entries(modalities)
            .filter(([_, active]) => active)
            .map(([key]) => key.toLowerCase());
          if (!activeModalities.includes(m.modality)) return false;
        }

        // Function calling
        if (functionCallingOnly && !m.hasFunctionCalling) return false;

        // Pricing filters
        if (hideFree && m.isFree) return false;
        if (discountedOnly && !m.inputDiscount && !m.outputDiscount) return false;

        // Max Input Pricing
        if (maxInputPrice > 0) {
          const num = parseFloat(m.inputPrice.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > maxInputPrice) return false;
        }

        // Max Output Pricing
        if (maxOutputPrice > 0) {
          const num = parseFloat(m.outputPrice.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > maxOutputPrice) return false;
        }

        // Compare only (show flagship popular models)
        if (compareOnly) {
          const nameLower = m.name.toLowerCase();
          const isFlagship =
            nameLower.includes("gpt-4") ||
            nameLower.includes("gpt-5") ||
            nameLower.includes("claude-3-5") ||
            nameLower.includes("claude-3-7") ||
            nameLower.includes("claude-sonnet") ||
            nameLower.includes("gemini") ||
            nameLower.includes("llama-3") ||
            nameLower.includes("deepseek") ||
            nameLower.includes("o1") ||
            nameLower.includes("o3");
          if (!isFlagship) return false;
        }

        // Context length
        if (minContext > 0 && m.contextNum < minContext) return false;

        // Search text
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            m.modality.toLowerCase().includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === undefined || valB === undefined) return 0;
        if (typeof valA === "number" && typeof valB === "number") {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [
    modelsList,
    activeTab,
    modalities,
    functionCallingOnly,
    hideFree,
    discountedOnly,
    maxInputPrice,
    maxOutputPrice,
    compareOnly,
    minContext,
    search,
    sortField,
    sortAsc,
  ]);

  const toggleSort = (field: keyof ModelLibraryItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    search,
    modalities,
    functionCallingOnly,
    hideFree,
    discountedOnly,
    maxInputPrice,
    maxOutputPrice,
    compareOnly,
    minContext,
  ]);

  // Pagination calculations (100 models per page)
  const totalPages = Math.max(1, Math.ceil(filteredModels.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredModels.length);
  const pagedModels = useMemo(() => {
    return filteredModels.slice(startIndex, endIndex);
  }, [filteredModels, startIndex, endIndex]);

  const handleJump = (inputVal: string) => {
    const p = parseInt(inputVal, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpInputTop("");
      setJumpInputBottom("");
    }
  };

  const getSuccessColorClass = (pct: number) => {
    if (pct >= 95) return "uno-pct-green";
    if (pct >= 70) return "uno-pct-yellow";
    if (pct >= 50) return "uno-pct-orange";
    return "uno-pct-red";
  };

  const getUptimeColorClass = (pct: number) => {
    if (pct >= 99) return "uno-pct-green";
    if (pct >= 75) return "uno-pct-yellow";
    return "uno-pct-red";
  };

  const renderPaginationBar = (position: "top" | "bottom") => {
    const jumpVal = position === "top" ? jumpInputTop : jumpInputBottom;
    const setJumpVal = position === "top" ? setJumpInputTop : setJumpInputBottom;

    return (
      <div className={`uno-pagination-bar uno-pagination-${position}`}>
        <div className="uno-pagination-info">
          <span>
            Showing <strong>{filteredModels.length === 0 ? 0 : startIndex + 1}</strong>–
            <strong>{endIndex}</strong> of <strong>{filteredModels.length}</strong> models
          </span>
          <span className="uno-pagination-pill-tag">100 / page</span>
        </div>

        <div className="uno-pagination-controls">
          {/* Step-by-Step One-by-One Navigation */}
          <button
            type="button"
            className="uno-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(1)}
            title="First Page"
          >
            « First
          </button>
          <button
            type="button"
            className="uno-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          {/* Numbered Page Buttons */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`uno-page-btn ${currentPage === pageNum ? "active" : ""}`}
              onClick={() => setCurrentPage(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            className="uno-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Next Page"
          >
            Next ›
          </button>
          <button
            type="button"
            className="uno-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            title="Last Page"
          >
            Last »
          </button>

          {/* Jumping Page Control */}
          <div className="uno-jump-box">
            <span className="uno-jump-label">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              placeholder={String(currentPage)}
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJump(jumpVal);
                }
              }}
              className="uno-jump-input"
            />
            <button
              type="button"
              className="uno-jump-btn"
              onClick={() => handleJump(jumpVal)}
            >
              Jump
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="models" className="uno-models-page-container">
      <div className={`uno-models-page-layout ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
          {/* ========================================================
              LEFT SIDEBAR: FILTERS — CUPERTINO STYLE
             ======================================================== */}
          {sidebarOpen && (
            <aside className="uno-filters-sidebar">
              <h3 className="uno-filters-title">
                <span>Filters</span>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#0A84FF",
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 4px",
                    }}
                  >
                    Reset all
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                    {filteredModels.length} models
                  </span>
                )}
              </h3>

              {/* Input Modalities Accordion */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("modalities")}>
                  <span>Input Modalities</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.modalities ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.modalities && (
                  <div className="uno-filter-list">
                    {["Text", "Image", "File", "Audio", "Video"].map((item) => (
                      <div
                        key={item}
                        className="uno-filter-label"
                        onClick={() => {
                          setModalities((prev) => ({ ...prev, [item]: !prev[item] }));
                        }}
                      >
                        <span className={`uno-checkbox ${modalities[item] ? "checked" : ""}`}>
                          {modalities[item] && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tools Accordion */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("tools")}>
                  <span>Tools</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.tools ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.tools && (
                  <div className="uno-filter-list">
                    <div
                      className="uno-filter-label"
                      onClick={() => {
                        setFunctionCallingOnly((prev) => !prev);
                      }}
                    >
                      <span className={`uno-checkbox ${functionCallingOnly ? "checked" : ""}`}>
                        {functionCallingOnly && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </span>
                      <span>Function calling</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Filter Accordion */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("pricing")}>
                  <span>Pricing</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.pricing ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.pricing && (
                  <div className="uno-filter-list">
                    <div
                      className="uno-filter-label"
                      onClick={() => {
                        setHideFree((prev) => !prev);
                      }}
                    >
                      <span className={`uno-checkbox ${hideFree ? "checked" : ""}`}>
                        {hideFree && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </span>
                      <span>Hide free</span>
                    </div>
                    <div
                      className="uno-filter-label"
                      onClick={() => {
                        setDiscountedOnly((prev) => !prev);
                      }}
                    >
                      <span className={`uno-checkbox ${discountedOnly ? "checked" : ""}`}>
                        {discountedOnly && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </span>
                      <span>Discounted only</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Context Length Slider — Interactive */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("context")}>
                  <span>Context Length</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.context ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.context && (
                  <div className="uno-slider-wrap">
                    <div className="uno-slider-labels">
                      <span>{minContext > 0 ? `${Math.round(minContext / 1000)}K+ min` : "Any length"}</span>
                      {minContext > 0 && (
                        <span
                          onClick={() => setMinContext(0)}
                          style={{ cursor: "pointer", color: "#0A84FF", fontWeight: 600 }}
                        >
                          Reset
                        </span>
                      )}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000000}
                      step={10000}
                      value={minContext}
                      onChange={(e) => setMinContext(Number(e.target.value))}
                      className="uno-range-slider"
                      title={`${minContext} tokens`}
                    />
                    <div className="uno-context-presets">
                      <button
                        type="button"
                        className={`uno-preset-btn ${minContext === 0 ? "active" : ""}`}
                        onClick={() => setMinContext(0)}
                      >
                        Any
                      </button>
                      <button
                        type="button"
                        className={`uno-preset-btn ${minContext === 32000 ? "active" : ""}`}
                        onClick={() => setMinContext(32000)}
                      >
                        32K
                      </button>
                      <button
                        type="button"
                        className={`uno-preset-btn ${minContext === 128000 ? "active" : ""}`}
                        onClick={() => setMinContext(128000)}
                      >
                        128K
                      </button>
                      <button
                        type="button"
                        className={`uno-preset-btn ${minContext === 1000000 ? "active" : ""}`}
                        onClick={() => setMinContext(1000000)}
                      >
                        1M
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Pricing Filter */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("inputPricing")}>
                  <span>Input Pricing</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.inputPricing ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.inputPricing && (
                  <div className="uno-context-presets" style={{ marginTop: 2 }}>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxInputPrice === 0 ? "active" : ""}`}
                      onClick={() => setMaxInputPrice(0)}
                    >
                      Any
                    </button>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxInputPrice === 1 ? "active" : ""}`}
                      onClick={() => setMaxInputPrice(1)}
                    >
                      &lt; $1
                    </button>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxInputPrice === 5 ? "active" : ""}`}
                      onClick={() => setMaxInputPrice(5)}
                    >
                      &lt; $5
                    </button>
                  </div>
                )}
              </div>

              {/* Output Pricing Filter */}
              <div className="uno-filter-section">
                <div className="uno-filter-header" onClick={() => toggleSection("outputPricing")}>
                  <span>Output Pricing</span>
                  <span style={{ display: "inline-flex", opacity: 0.6 }}>
                    {collapsedSections.outputPricing ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    )}
                  </span>
                </div>
                {!collapsedSections.outputPricing && (
                  <div className="uno-context-presets" style={{ marginTop: 2 }}>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxOutputPrice === 0 ? "active" : ""}`}
                      onClick={() => setMaxOutputPrice(0)}
                    >
                      Any
                    </button>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxOutputPrice === 2 ? "active" : ""}`}
                      onClick={() => setMaxOutputPrice(2)}
                    >
                      &lt; $2
                    </button>
                    <button
                      type="button"
                      className={`uno-preset-btn ${maxOutputPrice === 10 ? "active" : ""}`}
                      onClick={() => setMaxOutputPrice(10)}
                    >
                      &lt; $10
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* ========================================================
              RIGHT MAIN AREA: MODEL LIBRARY
             ======================================================== */}
          <main className="uno-library-main">
            {/* Top Toolbar */}
            <div className="uno-library-topbar">
              <h2 className="uno-library-title">Model Library</h2>

              <div className="uno-library-actions">
                <div className="uno-search-library">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className={`uno-btn-tool ${compareOnly ? "active" : ""}`}
                  onClick={() => setCompareOnly((prev) => !prev)}
                  title={compareOnly ? "Show all models" : "Compare flagship models"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                  <span>{compareOnly ? "Comparing" : "Compare"}</span>
                </button>

                <button
                  type="button"
                  className="uno-btn-tool"
                  onClick={() => toggleSort("released")}
                  title={`Sorted by ${sortField} (${sortAsc ? "Ascending" : "Descending"})`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="7 10 12 15 17 10"></polyline>
                  </svg>
                  <span>{sortField === "released" ? (sortAsc ? "Oldest" : "Newest") : "Sort"}</span>
                </button>

                <div style={{ display: "flex", gap: 2 }}>
                  <button
                    type="button"
                    className={`uno-btn-tool ${viewMode === "grid" ? "active" : ""}`}
                    style={{ padding: "8px 10px" }}
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                  >
                    ⊞
                  </button>
                  <button
                    type="button"
                    className={`uno-btn-tool ${viewMode === "table" ? "active" : ""}`}
                    style={{ padding: "8px 10px" }}
                    onClick={() => setViewMode("table")}
                    title="List view"
                  >
                    ≡
                  </button>
                </div>
              </div>
            </div>

            {/* Modalities Tabs (Screenshot) */}
            <div className="uno-modality-tabs">
              <button
                type="button"
                className={`uno-icon-btn ${sidebarOpen ? "active" : ""}`}
                style={{ padding: "6px 10px", marginRight: 4, display: "inline-flex", alignItems: "center", gap: 6 }}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
                {!sidebarOpen && <span style={{ fontSize: 11, fontWeight: 600 }}>Show Filters</span>}
              </button>

              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "All" ? "active" : ""}`}
                onClick={() => setActiveTab("All")}
              >
                <span>⊞ All</span>
                <span className="uno-tab-count">{counts.All}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Text" ? "active" : ""}`}
                onClick={() => setActiveTab("Text")}
              >
                <span>T Text</span>
                <span className="uno-tab-count">{counts.Text}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Image" ? "active" : ""}`}
                onClick={() => setActiveTab("Image")}
              >
                <span>🖼 Image</span>
                <span className="uno-tab-count">{counts.Image}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Audio" ? "active" : ""}`}
                onClick={() => setActiveTab("Audio")}
              >
                <span>🎙 Audio</span>
                <span className="uno-tab-count">{counts.Audio}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Video" ? "active" : ""}`}
                onClick={() => setActiveTab("Video")}
              >
                <span>🎥 Video</span>
                <span className="uno-tab-count">{counts.Video}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Embeddings" ? "active" : ""}`}
                onClick={() => setActiveTab("Embeddings")}
              >
                <span>🗂 Embeddings</span>
                <span className="uno-tab-count">{counts.Embeddings}</span>
              </button>
              <button
                type="button"
                className={`uno-modality-tab ${activeTab === "Decisions" ? "active" : ""}`}
                onClick={() => setActiveTab("Decisions")}
              >
                <span>⚖ Decisions</span>
                <span className="uno-tab-count">{counts.Decisions}</span>
              </button>
            </div>

            {/* Top Pagination Bar */}
            {renderPaginationBar("top")}

            {/* View Mode: Card Grid or Rich Table */}
            {viewMode === "grid" ? (
              <div className="uno-models-grid">
                {pagedModels.map((item) => (
                  <div key={item.id} className="uno-model-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="uno-cell-model">
                        <span className="uno-provider-symbol">{item.symbol}</span>
                        <span className="uno-model-title">{item.name}</span>
                      </div>
                      {item.isFree && (
                        <span className="uno-pill-free-badge">
                          <span style={{ fontSize: 10 }}>🎁</span>
                          <span>free</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      <span>Input: <strong style={{ color: "#fff" }}>{item.inputPrice}</strong></span>
                      <span>Output: <strong style={{ color: "#fff" }}>{item.outputPrice}</strong></span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--uno-text-muted)" }}>
                      <span>Context: {item.context}</span>
                      <span className={getUptimeColorClass(item.uptime)}>{item.uptime.toFixed(1)}% uptime</span>
                      <span className={getSuccessColorClass(item.success)}>{item.success.toFixed(1)}% success</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Screenshot 2 Rich Table */
              <div className="uno-rich-table-wrap">
                <table className="uno-rich-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>
                        Model {sortField === "name" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("weeklyTokens")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Weekly Tokens {sortField === "weeklyTokens" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("inputPrice")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Input {sortField === "inputPrice" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("outputPrice")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Output {sortField === "outputPrice" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("contextNum")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Context {sortField === "contextNum" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("uptime")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Uptime {sortField === "uptime" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("success")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Success {sortField === "success" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("latency")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Latency {sortField === "latency" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                      <th onClick={() => toggleSort("released")} style={{ cursor: "pointer", textAlign: "right" }}>
                        Released {sortField === "released" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedModels.map((item) => (
                      <tr key={item.id}>
                        {/* Model Name & Icon */}
                        <td>
                          <div className="uno-cell-model">
                            <span className="uno-provider-symbol">{item.symbol}</span>
                            <span className="uno-model-title">{item.name}</span>
                            {item.isFree && (
                              <span className="uno-pill-free-badge">
                                <span style={{ fontSize: 10 }}>🎁</span>
                                <span>free</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Weekly Tokens */}
                        <td style={{ textAlign: "right" }}>
                          <span className="mono" style={{ color: "#ffffff" }}>
                            {item.weeklyTokens}
                          </span>
                        </td>

                        {/* Input */}
                        <td style={{ textAlign: "right" }}>
                          <div className="uno-price-col" style={{ alignItems: "flex-end" }}>
                            <span className="uno-price-main">{item.inputPrice}</span>
                            {item.inputOriginal && item.inputDiscount && (
                              <div className="uno-price-discount">
                                <span className="uno-price-strikethrough">{item.inputOriginal}</span>
                                <span className="uno-price-off">{item.inputDiscount}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Output */}
                        <td style={{ textAlign: "right" }}>
                          <div className="uno-price-col" style={{ alignItems: "flex-end" }}>
                            <span className="uno-price-main">{item.outputPrice}</span>
                            {item.outputOriginal && item.outputDiscount && (
                              <div className="uno-price-discount">
                                <span className="uno-price-strikethrough">{item.outputOriginal}</span>
                                <span className="uno-price-off">{item.outputDiscount}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Context */}
                        <td style={{ textAlign: "right" }}>
                          <span className="mono" style={{ color: "#ffffff" }}>
                            {item.context}
                          </span>
                        </td>

                        {/* Uptime */}
                        <td style={{ textAlign: "right" }}>
                          <span className={getUptimeColorClass(item.uptime)}>
                            {item.uptime.toFixed(1)}%
                          </span>
                        </td>

                        {/* Success */}
                        <td style={{ textAlign: "right" }}>
                          <span className={getSuccessColorClass(item.success)}>
                            {item.success.toFixed(1)}%
                          </span>
                        </td>

                        {/* Latency */}
                        <td style={{ textAlign: "right" }}>
                          <span className="mono" style={{ color: "var(--uno-text-secondary)" }}>
                            {item.latency}
                          </span>
                        </td>

                        {/* Released */}
                        <td style={{ textAlign: "right" }}>
                          <span style={{ color: "var(--uno-text-muted)", fontSize: 12 }}>
                            {item.released}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredModels.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "var(--uno-text-muted)" }}>
                          No models found matching your current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Pagination Bar */}
            {renderPaginationBar("bottom")}
          </main>
        </div>
    </div>
  );
}
