"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";

export interface TOCItem {
  id: string;
  title: string;
  depth?: number;
}

interface DocsTOCProps {
  items: TOCItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
}

interface ItemCoord {
  top: number;
  bottom: number;
  mid: number;
}

export function DocsTOC({ items, activeId, onItemClick }: DocsTOCProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [coords, setCoords] = useState<ItemCoord[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(
    new Set(activeId ? [activeId] : items[0]?.id ? [items[0].id] : [])
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Measure DOM item positions for exact SVG path drawing
  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const newCoords = items.map((item) => {
      const el = itemRefs.current[item.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const top = rect.top - containerTop;
        const bottom = rect.bottom - containerTop;
        const mid = top + rect.height / 2;
        return { mid, top, bottom };
      }
      return { mid: 0, top: 0, bottom: 0 };
    });
    setCoords(newCoords);
  }, [items]);

  useEffect(() => {
    measure();
    const handleResize = () => measure();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [measure, items]);

  // Synchronize when external activeId changes
  useEffect(() => {
    if (activeId) {
      setActiveIds(new Set([activeId]));
    }
  }, [activeId]);

  // Scroll spy to track visible sections
  useEffect(() => {
    const handleScroll = () => {
      const viewportTop = 100;
      const viewportBottom = window.innerHeight * 0.75;

      const visibleIndices: number[] = [];

      items.forEach((item, idx) => {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= viewportBottom && rect.bottom >= viewportTop) {
            visibleIndices.push(idx);
          }
        }
      });

      if (visibleIndices.length > 0) {
        const nextSet = new Set<string>();
        visibleIndices.forEach((idx) => {
          nextSet.add(items[idx].id);
          // If a step-X child is visible, keep the parent "steps" active
          if (items[idx].id.startsWith("step-")) {
            nextSet.add("steps");
          }
        });
        setActiveIds(nextSet);
      } else {
        // Find last heading passed
        let lastPassedId = items[0]?.id;
        for (let i = 0; i < items.length; i++) {
          const el = document.getElementById(items[i].id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= viewportTop + 60) {
              lastPassedId = items[i].id;
            }
          }
        }
        if (lastPassedId) {
          const nextSet = new Set<string>([lastPassedId]);
          if (lastPassedId.startsWith("step-")) {
            nextSet.add("steps");
          }
          setActiveIds(nextSet);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const nextSet = new Set<string>([id]);
    if (id.startsWith("step-")) nextSet.add("steps");
    setActiveIds(nextSet);
    if (onItemClick) onItemClick(id);

    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 72;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (!items || items.length === 0) return null;

  // Geometry configuration matching UnoRouter
  const xBase = 2; // Level 2 items vertical line X
  const xIndent = 14; // Level 3 indented items vertical line X
  const jogHeight = 12; // 45 degree angle: dx = 12, dy = 12

  const getX = (depth?: number) => (depth === 3 ? xIndent : xBase);

  // Fallback coordinates if DOM not yet measured
  const effectiveCoords: ItemCoord[] =
    coords.length === items.length && coords[0]?.bottom > 0
      ? coords
      : items.map((_, idx) => ({
          top: idx * 30,
          bottom: (idx + 1) * 30,
          mid: idx * 30 + 15,
        }));

  // Helper to generate SVG path for a range of item indices
  const generatePath = (startI: number, endI: number, padStart = 0, padEnd = 0) => {
    if (startI > endI || items.length === 0) return "";

    const xStart = getX(items[startI].depth);
    const yStart = (effectiveCoords[startI]?.mid ?? 15) - padStart;

    if (startI === endI) {
      // Single active item: draw a vertical tick
      const mid = effectiveCoords[startI]?.mid ?? 15;
      return `M ${xStart} ${mid - 8} L ${xStart} ${mid + 8}`;
    }

    let d = `M ${xStart} ${yStart}`;

    for (let i = startI; i < endI; i++) {
      const xA = getX(items[i].depth);
      const xB = getX(items[i + 1].depth);
      const coordA = effectiveCoords[i];
      const coordB = effectiveCoords[i + 1];

      if (!coordA || !coordB) continue;

      if (xA === xB) {
        d += ` L ${xB} ${coordB.mid}`;
      } else {
        const midGap = (coordA.bottom + coordB.top) / 2;
        const jogStart = midGap - jogHeight / 2;
        const jogEnd = midGap + jogHeight / 2;
        d += ` L ${xA} ${jogStart} L ${xB} ${jogEnd} L ${xB} ${coordB.mid}`;
      }
    }

    if (padEnd > 0) {
      const xLast = getX(items[endI].depth);
      const yLast = (effectiveCoords[endI]?.mid ?? 15) + padEnd;
      d += ` L ${xLast} ${yLast}`;
    }

    return d;
  };

  // Full dark track
  const fullTrackD = generatePath(0, items.length - 1);

  // Active indices range
  const activeIndices = items
    .map((item, idx) => (activeIds.has(item.id) ? idx : -1))
    .filter((idx) => idx !== -1);

  let activeTrackD = "";
  if (activeIndices.length > 0) {
    const minI = Math.min(...activeIndices);
    const maxI = Math.max(...activeIndices);
    activeTrackD = generatePath(minI, maxI, 4, 4);
  }

  const totalHeight =
    effectiveCoords.length > 0
      ? effectiveCoords[effectiveCoords.length - 1].bottom + 16
      : items.length * 30 + 16;

  return (
    <aside
      style={{
        width: "100%",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: isDark ? "#8a8f98" : "#64748b",
          marginBottom: "14px",
          letterSpacing: "-0.01em",
        }}
      >
        On this page
      </div>

      {/* Track & Links container */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        {/* SVG branching track */}
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "28px",
            height: totalHeight,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {/* Base dark/light track */}
          {fullTrackD && (
            <path
              d={fullTrackD}
              fill="none"
              stroke={isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)"}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active highlight segment */}
          {activeTrackD && (
            <path
              d={activeTrackD}
              fill="none"
              stroke={isDark ? "#ffffff" : "#0f172a"}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Links list */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          {items.map((item, idx) => {
            const isActive = activeIds.has(item.id);
            const isSub = (item.depth ?? 2) === 3;
            const isHovered = hoveredId === item.id;

            return (
              <a
                key={item.id}
                ref={(el) => {
                  itemRefs.current[item.id] = el;
                }}
                href={`#${item.id}`}
                onClick={(e) => handleClick(item.id, e)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: "block",
                  paddingTop: "5px",
                  paddingBottom: "5px",
                  paddingLeft: isSub ? "30px" : "18px",
                  paddingRight: "8px",
                  fontSize: "13px",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive
                    ? (isDark ? "#ffffff" : "#0f172a")
                    : isHovered
                    ? (isDark ? "#e2e8f0" : "#1e293b")
                    : (isDark ? "#8a8f98" : "#64748b"),
                  textDecoration: "none",
                  lineHeight: "1.45",
                  transition: "color 0.15s ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: "pointer",
                }}
                title={item.title}
              >
                {item.title}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
