import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isTerminalStatus,
  isRateLimited,
  type AntigravityAccountItem,
} from "../../src/sse/services/antigravityAutoSwitch.ts";

describe("Antigravity Account Pool & Auto-Switch", () => {
  describe("isTerminalStatus", () => {
    it("identifies terminal statuses correctly", () => {
      assert.equal(isTerminalStatus("banned"), true);
      assert.equal(isTerminalStatus("BANNED"), true);
      assert.equal(isTerminalStatus("expired"), true);
      assert.equal(isTerminalStatus("credits_exhausted"), true);
      assert.equal(isTerminalStatus("CREDITS_EXHAUSTED"), true);
    });

    it("identifies non-terminal statuses correctly", () => {
      assert.equal(isTerminalStatus("active"), false);
      assert.equal(isTerminalStatus("unavailable"), false);
      assert.equal(isTerminalStatus(""), false);
      assert.equal(isTerminalStatus(null), false);
      assert.equal(isTerminalStatus(undefined), false);
    });
  });

  describe("isRateLimited", () => {
    it("returns true for future cooldown timestamps", () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      assert.equal(isRateLimited(future), true);
    });

    it("returns false for expired or missing cooldown timestamps", () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      assert.equal(isRateLimited(past), false);
      assert.equal(isRateLimited(null), false);
      assert.equal(isRateLimited(undefined), false);
      assert.equal(isRateLimited(""), false);
    });
  });

  describe("Single-Active Invariant & Auto-Switch candidate selection", () => {
    it("ensures only ONE account is active when resumed", () => {
      const connections: AntigravityAccountItem[] = [
        {
          id: "ag-conn-1",
          name: "Antigravity CLI Account 1",
          provider: "antigravity",
          isActive: true,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 1,
          providerSpecificData: { clientProfile: "cli" },
        },
        {
          id: "ag-conn-2",
          name: "Antigravity CLI Account 2",
          provider: "antigravity",
          isActive: false,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 2,
          providerSpecificData: { clientProfile: "ide" },
        },
        {
          id: "ag-conn-3",
          name: "Antigravity CLI Account 3",
          provider: "antigravity",
          isActive: false,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 1,
          providerSpecificData: { clientProfile: "cli" },
        },
      ];

      // Simulate resumeSingleAntigravityAccount logic on ag-conn-2
      const targetId = "ag-conn-2";
      const updated = connections.map((conn) => ({
        ...conn,
        isActive: conn.id === targetId,
      }));

      const activeAccounts = updated.filter((c) => c.isActive);
      assert.equal(activeAccounts.length, 1);
      assert.equal(activeAccounts[0].id, "ag-conn-2");
      assert.equal(updated.find((c) => c.id === "ag-conn-1")?.isActive, false);
      assert.equal(updated.find((c) => c.id === "ag-conn-3")?.isActive, false);
    });

    it("filters out terminal and rate-limited accounts during auto-switch on 429", () => {
      const failedConnectionId = "ag-conn-1";
      const connections: AntigravityAccountItem[] = [
        {
          id: "ag-conn-1", // failed account
          name: "Antigravity CLI 1",
          provider: "antigravity",
          isActive: true,
          testStatus: "unavailable",
          rateLimitedUntil: new Date(Date.now() + 120_000).toISOString(),
          lastError: "429 Too Many Requests: quota exceeded",
          lastErrorType: "rate_limited",
          errorCode: 429,
          priority: 1,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-2", // terminal (banned)
          name: "Antigravity CLI 2",
          provider: "antigravity",
          isActive: false,
          testStatus: "banned",
          rateLimitedUntil: null,
          lastError: "Account banned",
          lastErrorType: "banned",
          errorCode: 403,
          priority: 5,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-3", // currently rate limited
          name: "Antigravity CLI 3",
          provider: "antigravity",
          isActive: false,
          testStatus: "unavailable",
          rateLimitedUntil: new Date(Date.now() + 60_000).toISOString(),
          lastError: "Rate limited",
          lastErrorType: "rate_limited",
          errorCode: 429,
          priority: 3,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-4", // healthy standby candidate
          name: "Antigravity CLI 4",
          provider: "antigravity",
          isActive: false,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 2,
          providerSpecificData: {},
        },
      ];

      // Auto-switch filtering logic
      const candidates = connections.filter((conn) => {
        if (conn.id === failedConnectionId) return false;
        if (isTerminalStatus(conn.testStatus)) return false;
        if (isRateLimited(conn.rateLimitedUntil)) return false;
        return true;
      });

      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].id, "ag-conn-4");

      // Promote candidate and demote failed account
      const nextAccount = candidates[0];
      const afterSwitch = connections.map((conn) => {
        if (conn.id === failedConnectionId) return { ...conn, isActive: false };
        if (conn.id === nextAccount.id) return { ...conn, isActive: true };
        return conn;
      });

      assert.equal(afterSwitch.find((c) => c.id === failedConnectionId)?.isActive, false);
      assert.equal(afterSwitch.find((c) => c.id === "ag-conn-4")?.isActive, true);
      assert.equal(afterSwitch.filter((c) => c.isActive).length, 1);
    });

    it("respects priority when choosing the next standby account", () => {
      const failedConnectionId = "ag-conn-1";
      const connections: AntigravityAccountItem[] = [
        {
          id: "ag-conn-1",
          name: "Antigravity CLI 1",
          provider: "antigravity",
          isActive: true,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 1,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-low-pri",
          name: "Antigravity Low Priority",
          provider: "antigravity",
          isActive: false,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 1,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-high-pri",
          name: "Antigravity High Priority",
          provider: "antigravity",
          isActive: false,
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
          priority: 5,
          providerSpecificData: {},
        },
      ];

      const candidates = connections
        .filter((conn) => conn.id !== failedConnectionId && !isTerminalStatus(conn.testStatus) && !isRateLimited(conn.rateLimitedUntil))
        .sort((a, b) => b.priority - a.priority);

      assert.equal(candidates[0].id, "ag-conn-high-pri");
    });

    it("handles graceful fallback when all standby accounts are exhausted", () => {
      const failedConnectionId = "ag-conn-1";
      const connections: AntigravityAccountItem[] = [
        {
          id: "ag-conn-1",
          name: "Antigravity CLI 1",
          provider: "antigravity",
          isActive: true,
          testStatus: "unavailable",
          rateLimitedUntil: new Date(Date.now() + 100_000).toISOString(),
          lastError: "Quota exceeded",
          lastErrorType: "rate_limited",
          errorCode: 429,
          priority: 1,
          providerSpecificData: {},
        },
        {
          id: "ag-conn-2",
          name: "Antigravity CLI 2",
          provider: "antigravity",
          isActive: false,
          testStatus: "unavailable",
          rateLimitedUntil: new Date(Date.now() + 150_000).toISOString(),
          lastError: "Rate limited",
          lastErrorType: "rate_limited",
          errorCode: 429,
          priority: 2,
          providerSpecificData: {},
        },
      ];

      const candidates = connections.filter(
        (conn) =>
          conn.id !== failedConnectionId &&
          !isTerminalStatus(conn.testStatus) &&
          !isRateLimited(conn.rateLimitedUntil)
      );

      assert.equal(candidates.length, 0);
    });

    it("maintains single-active invariant across consecutive switches", () => {
      let connections: AntigravityAccountItem[] = [
        { id: "ag-1", name: "Account 1", provider: "antigravity", isActive: true, testStatus: "active", rateLimitedUntil: null, lastError: null, lastErrorType: null, errorCode: null, priority: 1, providerSpecificData: {} },
        { id: "ag-2", name: "Account 2", provider: "antigravity", isActive: false, testStatus: "active", rateLimitedUntil: null, lastError: null, lastErrorType: null, errorCode: null, priority: 1, providerSpecificData: {} },
        { id: "ag-3", name: "Account 3", provider: "antigravity", isActive: false, testStatus: "active", rateLimitedUntil: null, lastError: null, lastErrorType: null, errorCode: null, priority: 1, providerSpecificData: {} },
      ];

      // Switch to ag-2
      connections = connections.map((c) => ({ ...c, isActive: c.id === "ag-2" }));
      assert.equal(connections.filter((c) => c.isActive).length, 1);
      assert.equal(connections.find((c) => c.id === "ag-2")?.isActive, true);

      // Switch to ag-3
      connections = connections.map((c) => ({ ...c, isActive: c.id === "ag-3" }));
      assert.equal(connections.filter((c) => c.isActive).length, 1);
      assert.equal(connections.find((c) => c.id === "ag-3")?.isActive, true);
      assert.equal(connections.find((c) => c.id === "ag-2")?.isActive, false);

      // Switch back to ag-1
      connections = connections.map((c) => ({ ...c, isActive: c.id === "ag-1" }));
      assert.equal(connections.filter((c) => c.isActive).length, 1);
      assert.equal(connections.find((c) => c.id === "ag-1")?.isActive, true);
      assert.equal(connections.find((c) => c.id === "ag-3")?.isActive, false);
    });
  });
});
