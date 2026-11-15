import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useSiteScope } from "@/shared/hooks/useSiteScope";

it("hides providers during loading, failed fetches and a switch to another site", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
  function Probe({ site }: { site: string }) {
    const scope = useSiteScope(site);
    return <span>{scope.providers === null ? "all" : scope.providers.size}</span>;
  }
  try {
    await act(async () => {
      root.render(<Probe site="a" />);
    });
    expect(container.textContent).toBe("0");
    fetchMock.mockImplementation(() => new Promise(() => {}));
    act(() => {
      root.render(<Probe site="b" />);
    });
    expect(container.textContent).toBe("0");
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
