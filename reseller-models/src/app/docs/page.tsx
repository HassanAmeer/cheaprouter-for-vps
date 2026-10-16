"use client";

import React, { useState, useEffect } from "react";
import "./docs.css";
import { DocsSidebar } from "./components/DocsSidebar";
import { DocsTOC, TOCItem } from "./components/DocsTOC";
import GuideTemplate from "./components/GuideTemplate";
import { GUIDES_REGISTRY } from "./data/guidesData";
import { AiAppsView } from "./views/AiAppsView";
import IntroductionView from "./views/IntroductionView";
import ApiReferenceView, { ApiTabType } from "./views/ApiReferenceView";
import HarnessView from "./views/HarnessView";
import CCSwitchView from "./views/CCSwitchView";
import { Zap } from "lucide-react";
import Link from "next/link";
import { SpaceButton } from "@/components/ui/space-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

export default function DocsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://localhost:3001");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
      const hash = window.location.hash.replace("#", "");
      if (hash) setActiveSection(hash);

      const onHashChange = () => {
        const h = window.location.hash.replace("#", "");
        if (h) setActiveSection(h);
      };
      window.addEventListener("hashchange", onHashChange);
      return () => window.removeEventListener("hashchange", onHashChange);
    }
  }, []);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    setIsMobileMenuOpen(false);
    if (typeof window !== "undefined") {
      window.location.hash = id;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getTOCItems = (): TOCItem[] => {
    const guide = GUIDES_REGISTRY[activeSection];
    if (guide) {
      const items: TOCItem[] = [
        { id: "overview", title: "Overview", depth: 2 },
        { id: "quick-config", title: "Quick Config", depth: 2 },
        { id: "compatibility", title: "Compatibility", depth: 2 },
        { id: "steps", title: "Setup steps", depth: 2 },
      ];
      guide.steps.forEach((step, idx) => {
        items.push({ id: `step-${idx + 1}`, title: step.title, depth: 3 });
      });
      if (guide.gotchas && guide.gotchas.length > 0)
        items.push({ id: "gotchas", title: "Gotchas", depth: 2 });
      return items;
    }

    if (activeSection === "ai-apps")
      return [
        { id: "overview", title: "Overview", depth: 2 },
        { id: "category-coding", title: "Coding Agents & IDEs", depth: 2 },
        { id: "category-roleplay", title: "Character & Fiction Clients", depth: 2 },
        { id: "category-chat", title: "Chat & Desktop Clients", depth: 2 },
      ];

    if (activeSection === "overview")
      return [
        { id: "overview", title: "Overview", depth: 2 },
        { id: "quick-config", title: "Gateway Endpoints", depth: 2 },
        { id: "connectors", title: "Connectors & Integrations", depth: 2 },
        { id: "architecture", title: "Universal Architecture", depth: 2 },
      ];

    if (activeSection === "models")
      return [
        { id: "all-models", title: "All Models", depth: 2 },
      ];

    if (activeSection === "custom-api" || activeSection === "apis" || activeSection === "chat-completions")
      return [
        { id: "overview", title: "Custom API / SDK", depth: 2 },
        { id: "quick-config", title: "Language SDK Snippets", depth: 2 },
      ];

    if (activeSection === "playground")
      return [
        { id: "overview", title: "Test Playground", depth: 2 },
        { id: "endpoints", title: "Endpoint & Models", depth: 2 },
        { id: "output", title: "Terminal Output", depth: 2 },
      ];

    return [
      { id: "overview", title: "Overview", depth: 2 },
      { id: "quick-config", title: "Configuration", depth: 2 },
    ];
  };

  const renderContent = () => {
    const guide = GUIDES_REGISTRY[activeSection];
    if (guide) {
      return (
        <GuideTemplate
          key={guide.slug}
          slug={guide.slug}
          title={guide.title}
          subtitle={guide.subtitle}
          iconKey={guide.iconKey}
          categoryName={guide.categoryName}
          baseUrl={baseUrl}
          compatibility={guide.compatibility}
          steps={guide.steps}
          quickConfigCode={guide.quickConfigCode}
          recommendedModels={guide.recommendedModels}
          gotchas={guide.gotchas}
        />
      );
    }

    switch (activeSection) {
      case "ai-apps":
        return <AiAppsView onSelectGuide={handleSelectSection} />;
      case "overview":
        return <IntroductionView baseUrl={baseUrl} onSelectView={handleSelectSection} />;
      case "apis":
      case "chat-completions":
      case "models":
      case "custom-api":
        return (
          <ApiReferenceView
            baseUrl={baseUrl}
            activeTab={
              activeSection === "models"
                ? "models"
                : "custom-api"
            }
            onTabChange={(tab) => handleSelectSection(tab)}
          />
        );
      case "playground":
        return (
          <ApiReferenceView
            baseUrl={baseUrl}
            activeTab="playground"
            onTabChange={(tab) => handleSelectSection(tab)}
          />
        );
      case "harness":
        return <HarnessView baseUrl={baseUrl} />;
      case "cc-switch":
        return <CCSwitchView baseUrl={baseUrl} />;
      default:
        return <AiAppsView onSelectGuide={handleSelectSection} />;
    }
  };

  return (
    <div
      data-docs-layout
      style={{
        backgroundColor: isDark ? "#050505" : "#f8fafc",
        color: isDark ? "#f8fafc" : "#0f172a",
        minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* ── Top Header Bar ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "54px",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
          padding: "0 24px",
          backgroundColor: isDark ? "#050505" : "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 40,
          width: "100%",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "15px",
            fontWeight: 600,
            color: isDark ? "#ffffff" : "#0f172a",
            textDecoration: "none",
            fontFamily: "'Newsreader', 'Lora', Georgia, serif",
          }}
        >
          <span style={{ color: "#ef4444", display: "flex", alignItems: "center" }}>
            <Zap size={18} fill="currentColor" />
          </span>
          <span>CheapRouter</span>
          <span
            style={{
              color: isDark ? "#6b7280" : "#94a3b8",
              fontWeight: 400,
              fontSize: "13.5px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            / Docs
          </span>
        </Link>

        {/* Right side: Test API button & Get API Key button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SpaceButton
            variant="nav-outline"
            href="#playground"
            onClick={() => handleSelectSection("playground")}
            style={{ height: "36px", width: "auto", minWidth: "105px", cursor: "pointer" }}
          >
            Test API
          </SpaceButton>

          <SpaceButton
            variant="nav-outline"
            href="/signup"
            style={{ height: "36px", width: "auto", minWidth: "120px" }}
          >
            Get API Key
          </SpaceButton>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main 3-column layout ── */}
      <div
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          minHeight: "calc(100vh - 54px)",
        }}
      >
        {/* Left Sidebar */}
        <DocsSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          mobileOpen={isMobileMenuOpen}
        />

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 39,
            }}
          />
        )}

        {/* Center content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "36px 40px",
            overflowY: "visible",
          }}
        >
          {renderContent()}
        </main>

        {/* Right TOC — visible on xl+ screens */}
        <div className="docs-toc-col">
          <DocsTOC items={getTOCItems()} />
        </div>
      </div>
    </div>
  );
}
