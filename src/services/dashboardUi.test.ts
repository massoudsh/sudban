import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";

function dashboard() {
  const { window } = parseHTML(readFileSync("public/dashboard.html", "utf8"));
  window.HTMLElement.prototype.focus = () => {};
  const fetch = vi.fn();
  const context = createContext({ document: window.document, Node: window.Node, Intl, Date, FormData, console, fetch });
  runInContext(readFileSync("public/dashboard.js", "utf8"), context);
  runInContext(readFileSync("public/workflows.js", "utf8"), context);
  return { context, document: window.document, fetch, window };
}

describe("dashboard DOM logic without a browser", () => {
  it("renders untrusted product strings as text, never HTML", () => {
    const { context, document } = dashboard();
    runInContext('state.cards = [{product: {name: "<img src=x onerror=alert(1)>", sku: "<script>bad()</script>", currentPrice: 10}, setupRequired: true}]; renderCards()', context);
    expect(document.querySelector("#product-grid img")).toBeNull();
    expect(document.querySelector("#product-grid script")).toBeNull();
    expect(document.querySelector("#product-grid")!.textContent).toContain("<img");
  });
  it("supports empty search results", () => {
    const { context, document } = dashboard();
    runInContext('state.cards = [{product:{name:"Phone",sku:"S1"}}]; document.querySelector("#search").value="missing";renderCards()', context);
    expect(document.querySelector("#product-grid")!.textContent).toContain("پیدا نشد");
  });
  it("makes onboarding navigation functional", () => {
    const { document, window } = dashboard();
    document.querySelector('[data-view="onboarding"]')!.dispatchEvent(new window.Event("click"));
    expect(document.querySelector("#workflow-view")!.classList.contains("hidden")).toBe(false);
    expect(document.querySelector('#workflow-view input[name="sku"]')).not.toBeNull();
    expect(document.querySelector("#overview-view")!.classList.contains("hidden")).toBe(true);
  });
  it("keeps invalid credentials behind the login overlay", async () => {
    const { context, document, fetch } = dashboard();
    fetch.mockResolvedValue({ ok: false });
    await runInContext('enterDashboard("bad-key")', context);
    expect(document.querySelector("#app")!.classList.contains("hidden")).toBe(true);
    expect(document.querySelector("#auth-error")!.textContent).toContain("معتبر نیست");
  });
});
