"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Handle, Position, type Node, type Edge, type NodeTypes, type FitViewOptions } from "@xyflow/react";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { FlowCanvas } from "@/shared/components/flow/FlowCanvas";
import { StatusDot } from "@/shared/components/flow/StatusDot";
import { edgeStyle, FLOW_EDGE_COLORS, flowColorAlpha } from "@/shared/components/flow/edgeStyles";
import { getFallbackProviderColor } from "@/shared/utils/providerFallbackColor";
import { resolveTopologyNodeLabel } from "./topologyLabel";

// Rings: [capacity, rx, ry]. Each successive ring fits ~6 more nodes.
const RINGS: [number, number, number][] = [
  [8, 210, 132],
  [14, 370, 233],
  [20, 530, 334],
  [26, 690, 435],
  [32, 850, 536],
  [38, 1010, 637],
];

type ProviderConfig = { color?: string; name?: string; textIcon?: string };

function getProviderConfig(providerId: string): ProviderConfig {
  return (
    (AI_PROVIDERS as Record<string, ProviderConfig>)[providerId] || {
      color: getFallbackProviderColor(providerId),
      name: providerId,
    }
  );
}

export type TopologyModel = {
  id: string;
  originalModelId: string;
  name: string;
  customAlias?: string | null;
  isActive: boolean;
  isTested?: boolean;
  testStatus?: "verified" | "failed" | null;
  testHttpStatus?: number | null;
  testLatencyMs?: number | null;
  pricingTier?: "free" | "paid" | null;
  contextWindow?: number | null;
};

export type TopologyCombo = {
  id: string;
  name: string;
  strategy?: string;
  models?: string[];
  isActive?: boolean;
};

export type ProviderHealth = "active" | "error" | "idle";

export type ProviderEntry = {
  id?: string;
  provider: string;
  name?: string;
  status?: ProviderHealth;
  models?: TopologyModel[];
};

type ProviderNodeData = {
  label: string;
  color: string;
  providerId: string;
  active: boolean;
  error: boolean;
  /** Connection-health base state: a healthy connection with no in-flight traffic. */
  healthy: boolean;
  /** Most recently routed provider. Orthogonal to health. */
  last: boolean;
  modelCount?: number;
  verifiedCount?: number;
};

function ProviderNode({ data }: { data: ProviderNodeData }) {
  const { label, color, providerId, active, error, healthy, last, modelCount = 0, verifiedCount = 0 } = data;
  const GREEN = FLOW_EDGE_COLORS.active;
  const RED = FLOW_EDGE_COLORS.error;
  const AMBER = FLOW_EDGE_COLORS.last;
  const dotColor = active ? color : last ? AMBER : GREEN;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 bg-bg cursor-pointer hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
      style={{
        borderColor: error ? RED : active ? color : healthy ? GREEN : "var(--color-border)",
        boxShadow: error
          ? `0 0 12px ${flowColorAlpha(RED, 19)}`
          : active
            ? `0 0 12px ${color}30`
            : healthy
              ? `0 0 10px ${flowColorAlpha(GREEN, 13)}`
              : "none",
        minWidth: "150px",
      }}
    >
      {/* Target handles for Router / upstream connections */}
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />

      {/* Source handles for downstream Model / Combo connections */}
      <Handle type="source" position={Position.Right} id="source-right" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Top} id="source-top" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Left} id="source-left" className="!bg-transparent !border-0 !w-0 !h-0" />

      <div
        className="size-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <ProviderIcon providerId={providerId} size={16} type="color" />
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="text-xs font-semibold truncate"
          style={{
            color: active ? color : error ? RED : healthy ? GREEN : "var(--color-text-main)",
          }}
        >
          {label}
        </span>
        {modelCount > 0 && (
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <span>{modelCount} {modelCount === 1 ? "model" : "models"}</span>
            {verifiedCount > 0 && (
              <span className="text-emerald-500 font-medium">({verifiedCount} ✔)</span>
            )}
          </span>
        )}
      </div>

      {(active || error || healthy || last) && (
        <StatusDot color={dotColor} error={error} pulse={active || error} />
      )}
    </div>
  );
}

type ModelNodeData = {
  id: string;
  modelId: string;
  displayName: string;
  providerId: string;
  providerColor?: string;
  isActive: boolean;
  isTested: boolean;
  testStatus: "verified" | "failed" | null;
  testHttpStatus: number | null;
  testLatencyMs: number | null;
  pricingTier?: "free" | "paid" | null;
  contextWindow?: number | null;
  isActiveTraffic?: boolean;
};

function ModelNode({ data }: { data: ModelNodeData }) {
  const {
    displayName,
    modelId,
    testStatus,
    testHttpStatus,
    testLatencyMs,
    pricingTier,
    isActiveTraffic,
  } = data;

  const isVerified = testStatus === "verified" || testHttpStatus === 200;
  const isFailed = testStatus === "failed" || (testHttpStatus != null && testHttpStatus >= 400);

  return (
    <div
      className={`group relative flex flex-col justify-center px-3 py-2 rounded-xl border transition-all duration-200 bg-bg cursor-pointer hover:scale-[1.03] active:scale-[0.98] shadow-xs hover:shadow-md ${
        isActiveTraffic
          ? "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          : isVerified
            ? "border-emerald-500/40 hover:border-emerald-500"
            : isFailed
              ? "border-red-500/50 hover:border-red-500"
              : "border-border/70 hover:border-border"
      }`}
      style={{ minWidth: "220px", maxWidth: "270px" }}
      title={`${displayName} (${modelId})`}
    >
      <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />

      {/* Top line: Model Name + Badges */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[14px] text-text-muted shrink-0">smart_toy</span>
          <span className="text-xs font-semibold text-text-main truncate group-hover:text-primary transition-colors">
            {displayName || modelId}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pricingTier === "free" && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              FREE
            </span>
          )}
          {pricingTier === "paid" && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              PAID
            </span>
          )}
        </div>
      </div>

      {/* Bottom line: Test status & Latency */}
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[13px] text-emerald-500">check_circle</span>
              <span>{testHttpStatus || 200} OK</span>
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1 font-semibold text-red-500">
              <span className="material-symbols-outlined text-[13px]">error</span>
              <span>{testHttpStatus ? `HTTP ${testHttpStatus}` : "Failed"}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-text-muted">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Active</span>
            </span>
          )}
        </div>

        {testLatencyMs != null && testLatencyMs > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono text-[9px] font-medium bg-bg-subtle text-text-muted border border-border/60">
            <span className="material-symbols-outlined text-[10px] text-text-muted">speed</span>
            {testLatencyMs < 1000 ? `${testLatencyMs}ms` : `${(testLatencyMs / 1000).toFixed(2)}s`}
          </span>
        )}
      </div>
    </div>
  );
}

type ComboNodeData = {
  id: string;
  name: string;
  strategy: string;
  modelCount: number;
  isActive: boolean;
};

function ComboNode({ data }: { data: ComboNodeData }) {
  const { name, strategy, modelCount } = data;
  return (
    <div
      className="flex flex-col justify-center px-3 py-1.5 rounded-xl border-2 border-violet-500/50 bg-violet-500/8 hover:bg-violet-500/15 transition-all shadow-xs cursor-pointer"
      style={{ minWidth: "150px" }}
    >
      <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />

      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px] text-violet-500">alt_route</span>
        <span className="text-xs font-bold text-violet-600 dark:text-violet-400 truncate">{name}</span>
      </div>
      <div className="flex items-center justify-between text-[9px] text-text-muted mt-0.5">
        <span className="uppercase font-mono font-medium">{strategy || "combo"}</span>
        <span>{modelCount} targets</span>
      </div>
    </div>
  );
}

type RouterNodeData = { activeCount: number };

function RouterNode({ data }: { data: RouterNodeData }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-primary bg-primary/8 shadow-lg min-w-[140px] justify-center">
      <Handle type="source" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />

      <div className="flex items-center justify-center size-7 rounded-md bg-primary/15 shrink-0">
        <span className="material-symbols-outlined text-primary text-[16px]">route</span>
      </div>
      <span className="text-sm font-bold text-primary">CheapRouter</span>
      {data.activeCount > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
          {data.activeCount}
        </span>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  provider: ProviderNode as any,
  router: RouterNode as any,
  model: ModelNode as any,
  combo: ComboNode as any,
};

function getHandles(angle: number, cx: number): { sourceHandle: string; targetHandle: string } {
  const rel = (((angle + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (rel < Math.PI / 4 || rel > (7 * Math.PI) / 4)
    return { sourceHandle: "top", targetHandle: "bottom" };
  if (rel > (3 * Math.PI) / 4 && rel < (5 * Math.PI) / 4)
    return { sourceHandle: "bottom", targetHandle: "top" };
  return cx > 0
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: "left", targetHandle: "right" };
}

function buildTreeLayout(
  providers: ProviderEntry[],
  combos: TopologyCombo[],
  activeSet: Set<string>,
  lastSet: Set<string>,
  errorSet: Set<string>,
  statusFilter: "all" | "verified"
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const sorted = [...providers].sort((a, b) => {
    const rank = (p: ProviderEntry) => {
      const id = p.provider.toLowerCase();
      if (activeSet.has(id)) return 0;
      if (errorSet.has(id) || p.status === "error") return 1;
      if (lastSet.has(id)) return 2;
      if (p.status === "active") return 3;
      return 4;
    };
    const d = rank(a) - rank(b);
    return d !== 0 ? d : a.provider.toLowerCase().localeCompare(b.provider.toLowerCase());
  });

  const MODEL_HEIGHT = 56;
  const MODEL_GAP = 12;
  const PROVIDER_GAP = 32;
  const ROW_H = MODEL_HEIGHT + MODEL_GAP;

  const providerModelsMap = new Map<string, TopologyModel[]>();
  let totalModelRows = 0;

  for (const p of sorted) {
    let pModels = p.models || [];
    if (statusFilter === "verified") {
      pModels = pModels.filter((m) => m.testStatus === "verified" || m.testHttpStatus === 200);
    }
    providerModelsMap.set(p.provider, pModels);
    totalModelRows += Math.max(pModels.length, 1);
  }

  const comboRows = combos && combos.length > 0 ? combos.length : 0;
  const totalHeight = (totalModelRows + comboRows) * ROW_H + (sorted.length - 1) * PROVIDER_GAP;
  let currentY = -Math.max(totalHeight / 2, 80);

  nodes.push({
    id: "router",
    type: "router",
    position: { x: -380, y: -24 },
    data: { activeCount: activeSet.size },
    draggable: false,
  });

  for (const p of sorted) {
    const pid = p.provider.toLowerCase();
    const active = activeSet.has(pid);
    const trafficError = !active && errorSet.has(pid);
    const last = !active && !trafficError && lastSet.has(pid);
    const healthError = !active && !trafficError && p.status === "error";
    const healthy = !active && !trafficError && !healthError && p.status === "active";
    const error = trafficError || healthError;
    const config = getProviderConfig(p.provider);
    const nodeId = `provider-${p.provider}`;

    const pModels = providerModelsMap.get(p.provider) || [];
    const verifiedCount = pModels.filter(
      (m) => m.testStatus === "verified" || m.testHttpStatus === 200
    ).length;

    if (pModels.length > 0) {
      const blockHeight = pModels.length * ROW_H - MODEL_GAP;
      const providerY = currentY + blockHeight / 2 - 20;

      nodes.push({
        id: nodeId,
        type: "provider",
        position: { x: -90, y: providerY },
        data: {
          label: resolveTopologyNodeLabel(p.name, config.name, p.provider),
          color: config.color || "#6b7280",
          providerId: p.provider,
          active,
          error,
          healthy,
          last,
          modelCount: pModels.length,
          verifiedCount,
        } satisfies ProviderNodeData,
        draggable: false,
      });

      edges.push({
        id: `e-${nodeId}`,
        source: "router",
        sourceHandle: "right",
        target: nodeId,
        targetHandle: "left",
        animated: active,
        style: edgeStyle(active, last, error, healthy),
      });

      for (let mi = 0; mi < pModels.length; mi++) {
        const m = pModels[mi];
        const modelY = currentY + mi * ROW_H;
        const modelNodeId = `model-${p.provider}-${m.originalModelId}`;
        const isModelActive =
          activeSet.has(m.originalModelId.toLowerCase()) || activeSet.has(m.id.toLowerCase());
        const isModelVerified = m.testStatus === "verified" || m.testHttpStatus === 200;
        const isModelFailed =
          m.testStatus === "failed" || (m.testHttpStatus != null && m.testHttpStatus >= 400);

        nodes.push({
          id: modelNodeId,
          type: "model",
          position: { x: 200, y: modelY },
          data: {
            id: m.id,
            modelId: m.originalModelId,
            displayName: m.name,
            providerId: p.provider,
            providerColor: config.color,
            isActive: m.isActive,
            isTested: Boolean(m.isTested),
            testStatus: m.testStatus,
            testHttpStatus: m.testHttpStatus,
            testLatencyMs: m.testLatencyMs,
            pricingTier: m.pricingTier,
            contextWindow: m.contextWindow,
            isActiveTraffic: isModelActive,
          } satisfies ModelNodeData,
          draggable: false,
        });

        edges.push({
          id: `e-m-${nodeId}-${m.originalModelId}`,
          source: nodeId,
          sourceHandle: "source-right",
          target: modelNodeId,
          targetHandle: "left",
          animated: isModelActive,
          style: {
            stroke: isModelActive
              ? FLOW_EDGE_COLORS.active
              : isModelVerified
                ? "var(--orch-status-success)"
                : isModelFailed
                  ? FLOW_EDGE_COLORS.error
                  : "var(--color-border)",
            strokeWidth: isModelActive ? 2.5 : isModelVerified ? 1.5 : 1,
            opacity: isModelActive ? 1 : isModelVerified ? 0.8 : 0.4,
          },
        });
      }

      currentY += blockHeight + PROVIDER_GAP;
    } else {
      nodes.push({
        id: nodeId,
        type: "provider",
        position: { x: -90, y: currentY },
        data: {
          label: resolveTopologyNodeLabel(p.name, config.name, p.provider),
          color: config.color || "#6b7280",
          providerId: p.provider,
          active,
          error,
          healthy,
          last,
          modelCount: 0,
          verifiedCount: 0,
        } satisfies ProviderNodeData,
        draggable: false,
      });

      edges.push({
        id: `e-${nodeId}`,
        source: "router",
        sourceHandle: "right",
        target: nodeId,
        targetHandle: "left",
        animated: active,
        style: edgeStyle(active, last, error, healthy),
      });

      currentY += 50 + PROVIDER_GAP;
    }
  }

  // Active Combos
  if (combos && combos.length > 0) {
    for (const c of combos) {
      const comboNodeId = `combo-${c.id}`;
      nodes.push({
        id: comboNodeId,
        type: "combo",
        position: { x: -90, y: currentY },
        data: {
          id: c.id,
          name: c.name,
          strategy: c.strategy || "priority",
          modelCount: c.models?.length || 0,
          isActive: c.isActive !== false,
        } satisfies ComboNodeData,
        draggable: false,
      });

      edges.push({
        id: `e-router-${comboNodeId}`,
        source: "router",
        sourceHandle: "right",
        target: comboNodeId,
        targetHandle: "left",
        style: {
          stroke: "#8b5cf6",
          strokeWidth: 1.5,
          opacity: 0.7,
        },
      });

      if (Array.isArray(c.models)) {
        for (const target of c.models) {
          const matchedModelNode = nodes.find(
            (n) =>
              n.type === "model" &&
              ((n.data as ModelNodeData)?.modelId === target ||
                (n.data as ModelNodeData)?.id === target ||
                n.id.endsWith(`-${target}`))
          );
          if (matchedModelNode) {
            edges.push({
              id: `e-combo-target-${c.id}-${matchedModelNode.id}`,
              source: comboNodeId,
              sourceHandle: "right",
              target: matchedModelNode.id,
              targetHandle: "left",
              style: {
                strokeDasharray: "4,4",
                stroke: "#8b5cf6",
                strokeWidth: 1.5,
                opacity: 0.75,
              },
            });
          }
        }
      }

      currentY += 54 + 14;
    }
  }

  return { nodes, edges };
}

function buildOrbitLayout(
  providers: ProviderEntry[],
  activeSet: Set<string>,
  lastSet: Set<string>,
  errorSet: Set<string>,
  statusFilter: "all" | "verified",
  providersOnly: boolean
): { nodes: Node[]; edges: Edge[] } {
  const nodeW = 156;
  const nodeH = 28;
  const routerW = 148;
  const routerH = 44;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "router",
    type: "router",
    position: { x: -routerW / 2, y: -routerH / 2 },
    data: { activeCount: activeSet.size },
    draggable: false,
  });

  if (providers.length === 0) return { nodes, edges };

  const sorted = [...providers].sort((a, b) => {
    const rank = (p: ProviderEntry) => {
      const id = p.provider.toLowerCase();
      if (activeSet.has(id)) return 0;
      if (errorSet.has(id) || p.status === "error") return 1;
      if (lastSet.has(id)) return 2;
      if (p.status === "active") return 3;
      return 4;
    };
    const d = rank(a) - rank(b);
    return d !== 0 ? d : a.provider.toLowerCase().localeCompare(b.provider.toLowerCase());
  });

  let provIdx = 0;
  for (let ri = 0; ri < RINGS.length && provIdx < sorted.length; ri++) {
    const [cap, rx, ry] = RINGS[ri];
    const count = Math.min(cap, sorted.length - provIdx);

    for (let i = 0; i < count; i++) {
      const p = sorted[provIdx++];
      const pid = p.provider.toLowerCase();
      const active = activeSet.has(pid);
      const trafficError = !active && errorSet.has(pid);
      const last = !active && !trafficError && lastSet.has(pid);
      const healthError = !active && !trafficError && p.status === "error";
      const healthy = !active && !trafficError && !healthError && p.status === "active";
      const error = trafficError || healthError;
      const config = getProviderConfig(p.provider);
      const nodeId = `provider-${p.provider}`;

      let pModels = p.models || [];
      if (statusFilter === "verified") {
        pModels = pModels.filter((m) => m.testStatus === "verified" || m.testHttpStatus === 200);
      }
      const verifiedCount = pModels.filter(
        (m) => m.testStatus === "verified" || m.testHttpStatus === 200
      ).length;

      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const cx = rx * Math.cos(angle);
      const cy = ry * Math.sin(angle);
      const { sourceHandle, targetHandle } = getHandles(angle, cx);

      nodes.push({
        id: nodeId,
        type: "provider",
        position: { x: cx - nodeW / 2, y: cy - nodeH / 2 },
        data: {
          label: resolveTopologyNodeLabel(p.name, config.name, p.provider),
          color: config.color || "#6b7280",
          providerId: p.provider,
          active,
          error,
          healthy,
          last,
          modelCount: pModels.length,
          verifiedCount,
        } satisfies ProviderNodeData,
        draggable: false,
      });

      edges.push({
        id: `e-${nodeId}`,
        source: "router",
        sourceHandle,
        target: nodeId,
        targetHandle,
        animated: active,
        style: edgeStyle(active, last, error, healthy),
      });

      // Branching outer models in Orbit mode if not providersOnly
      if (!providersOnly && pModels.length > 0) {
        const outerR = rx + 160;
        const arcSpread = Math.PI / 6;
        for (let mi = 0; mi < pModels.length; mi++) {
          const m = pModels[mi];
          const mAngle =
            pModels.length === 1
              ? angle
              : angle - arcSpread / 2 + (arcSpread * mi) / (pModels.length - 1);
          const mcx = outerR * Math.cos(mAngle);
          const mcy = (ry + 100) * Math.sin(mAngle);
          const modelNodeId = `model-${p.provider}-${m.originalModelId}`;
          const isModelActive =
            activeSet.has(m.originalModelId.toLowerCase()) || activeSet.has(m.id.toLowerCase());
          const isModelVerified = m.testStatus === "verified" || m.testHttpStatus === 200;
          const isModelFailed =
            m.testStatus === "failed" || (m.testHttpStatus != null && m.testHttpStatus >= 400);

          nodes.push({
            id: modelNodeId,
            type: "model",
            position: { x: mcx - 110, y: mcy - 25 },
            data: {
              id: m.id,
              modelId: m.originalModelId,
              displayName: m.name,
              providerId: p.provider,
              providerColor: config.color,
              isActive: m.isActive,
              isTested: Boolean(m.isTested),
              testStatus: m.testStatus,
              testHttpStatus: m.testHttpStatus,
              testLatencyMs: m.testLatencyMs,
              pricingTier: m.pricingTier,
              contextWindow: m.contextWindow,
              isActiveTraffic: isModelActive,
            } satisfies ModelNodeData,
            draggable: false,
          });

          edges.push({
            id: `e-m-${nodeId}-${m.originalModelId}`,
            source: nodeId,
            sourceHandle: "source-right",
            target: modelNodeId,
            targetHandle: "left",
            animated: isModelActive,
            style: {
              stroke: isModelActive
                ? FLOW_EDGE_COLORS.active
                : isModelVerified
                  ? "var(--orch-status-success)"
                  : isModelFailed
                    ? FLOW_EDGE_COLORS.error
                    : "var(--color-border)",
              strokeWidth: isModelActive ? 2.5 : isModelVerified ? 1.5 : 1,
              opacity: isModelActive ? 1 : isModelVerified ? 0.75 : 0.4,
            },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

type Props = {
  providers?: ProviderEntry[];
  combos?: TopologyCombo[];
  activeRequests?: Array<{ provider?: string; model?: string }>;
  lastProvider?: string;
  errorProvider?: string;
  className?: string;
  showControls?: boolean;
  fitViewOptions?: FitViewOptions;
};

export default function ProviderTopology({
  providers = [],
  combos = [],
  activeRequests = [],
  lastProvider = "",
  errorProvider = "",
  className,
  showControls,
  fitViewOptions,
}: Props) {
  const t = useTranslations("common");
  const [viewMode, setViewMode] = useState<"tree" | "orbit" | "providersOnly">("tree");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified">("all");

  const activeKey = useMemo(
    () =>
      activeRequests
        .map((r) => r.provider?.toLowerCase() || r.model?.toLowerCase())
        .filter(Boolean)
        .sort()
        .join(","),
    [activeRequests]
  );
  const lastKey = lastProvider.toLowerCase();
  const errorKey = errorProvider.toLowerCase();

  const activeSet = useMemo(
    () => new Set<string>(activeKey ? activeKey.split(",") : []),
    [activeKey]
  );
  const lastSet = useMemo(() => new Set<string>(lastKey ? [lastKey] : []), [lastKey]);
  const errorSet = useMemo(() => new Set<string>(errorKey ? [errorKey] : []), [errorKey]);

  const { nodes, edges } = useMemo(() => {
    if (viewMode === "tree") {
      return buildTreeLayout(providers, combos, activeSet, lastSet, errorSet, statusFilter);
    }
    return buildOrbitLayout(
      providers,
      activeSet,
      lastSet,
      errorSet,
      statusFilter,
      viewMode === "providersOnly"
    );
  }, [providers, combos, activeSet, lastSet, errorSet, viewMode, statusFilter]);

  const fitKey = useMemo(
    () => `${viewMode}-${statusFilter}-${providers.length}-${combos.length}-${nodes.length}`,
    [viewMode, statusFilter, providers.length, combos.length, nodes.length]
  );

  const router = useRouter();

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "provider") {
        const providerId =
          (node.data as ProviderNodeData | undefined)?.providerId ||
          node.id.replace(/^provider-/, "");
        if (providerId) {
          router.push(`/dashboard/providers/${providerId}`);
        }
      } else if (node.type === "model") {
        router.push("/dashboard/curation");
      } else if (node.type === "combo") {
        router.push("/dashboard/combos");
      }
    },
    [router]
  );

  const containerClass =
    className ||
    "h-[270px] w-full min-w-0 rounded-xl border border-border/60 bg-bg-subtle/20 overflow-hidden sm:h-[295px]";

  if (providers.length === 0) {
    return (
      <div
        className={`${containerClass} flex flex-col items-center justify-center gap-2 text-text-muted`}
      >
        <span className="material-symbols-outlined text-[32px]">device_hub</span>
        <p className="text-sm">{t("providerTopologyEmpty")}</p>
      </div>
    );
  }

  const totalModelsCount = providers.reduce((acc, p) => acc + (p.models?.length || 0), 0);
  const verifiedModelsCount = providers.reduce(
    (acc, p) =>
      acc +
      (p.models?.filter((m) => m.testStatus === "verified" || m.testHttpStatus === 200).length || 0),
    0
  );

  return (
    <div className="relative w-full h-full min-w-0">
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitKey={fitKey}
        className={containerClass}
        onNodeClick={handleNodeClick}
        showControls={showControls ?? true}
        fitViewOptions={fitViewOptions}
      >
        {/* Floating View & Filter Toolbar */}
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-bg/85 dark:bg-zinc-900/85 backdrop-blur-md border border-border/80 shadow-xs text-[11px]">
          <div className="flex items-center p-0.5 rounded-lg bg-bg-subtle/80 border border-border/50">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                viewMode === "tree"
                  ? "bg-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Tree Flow
            </button>
            <button
              type="button"
              onClick={() => setViewMode("orbit")}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                viewMode === "orbit"
                  ? "bg-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Orbit
            </button>
            <button
              type="button"
              onClick={() => setViewMode("providersOnly")}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                viewMode === "providersOnly"
                  ? "bg-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Providers
            </button>
          </div>

          {totalModelsCount > 0 && viewMode !== "providersOnly" && (
            <button
              type="button"
              onClick={() => setStatusFilter((f) => (f === "all" ? "verified" : "all"))}
              className={`px-2 py-0.5 rounded-lg border font-medium flex items-center gap-1 transition-all ${
                statusFilter === "verified"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border/60 text-text-muted hover:text-text-main bg-bg"
              }`}
              title="Toggle filter"
            >
              <span className="material-symbols-outlined text-[13px] text-emerald-500">verified</span>
              <span>
                {statusFilter === "verified"
                  ? `Verified (${verifiedModelsCount})`
                  : `All (${totalModelsCount})`}
              </span>
            </button>
          )}
        </div>
      </FlowCanvas>
    </div>
  );
}
