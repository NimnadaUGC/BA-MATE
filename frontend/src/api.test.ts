import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("refreshes a restarted local service session before saving", async () => {
  const calls: { url: string; token?: string }[] = [];
  let activeToken = "first";
  const fetchMock = vi.fn(async (input: string, options?: RequestInit) => {
    const url = String(input);
    const token = (options?.headers as Record<string, string> | undefined)?.["X-BA-Session"];
    calls.push({ url, token });
    if (url.endsWith("/api/session")) return new Response(JSON.stringify({ token: activeToken }), { status: 200 });
    if (token !== activeToken) return new Response(JSON.stringify({ detail: "Session expired" }), { status: 401 });
    return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { api } = await import("./api");
  await api("/api/workspace", { method: "PUT", body: "{}" });
  activeToken = "second";
  expect(await api<{ revision: number }>("/api/workspace", { method: "PUT", body: "{}" })).toEqual({ revision: 2 });
  expect(calls.map(call => call.token)).toEqual([undefined, "first", "first", undefined, "second"]);
});
