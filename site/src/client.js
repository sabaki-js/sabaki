// Progressive enhancement: live demo console, copy buttons, quickstart tabs.
// The page is fully readable without this file; the first demo result is pre-rendered.
import { route, predict } from "./engine.js";
import { renderResult } from "./console-render.js";

const cfg = JSON.parse(document.getElementById("demo-config")?.textContent ?? "{}");
const S = cfg.S ?? {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Copy buttons ----------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const holder = btn.closest(".code, .install");
  const text = holder?.querySelector("code")?.innerText.replace(/^\$ /, "") ?? "";
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = btn.dataset.done;
  } catch {
    const r = document.createRange();
    r.selectNodeContents(holder.querySelector("code"));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    btn.textContent = btn.dataset.done;
  }
  setTimeout(() => (btn.textContent = btn.dataset.label), 1600);
});

// ---------- Quickstart tabs (WAI-ARIA tabs pattern) ----------
for (const root of $$("[data-tabs]")) {
  const tabs = $$('[role="tab"]', root);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const select = (i, focus) => {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      panels[j].hidden = i !== j;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i));
    t.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowRight") { e.preventDefault(); select((i + 1) % tabs.length, true); }
      else if (k === "ArrowLeft") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      else if (k === "Home") { e.preventDefault(); select(0, true); }
      else if (k === "End") { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  select(0);
  // hide the visually hidden per-panel headings from the tab order only; they stay for crawlers
}

// ---------- Demo console ----------
const consoleEl = document.getElementById("try");
const input = document.getElementById("state");
const resultEl = document.getElementById("result");
if (consoleEl && input && resultEl) {
  const base = new URL(document.querySelector('link[rel="icon"]').href).pathname.replace(/assets\/.*$/, "");
  let router = null;
  const weights = new Map();
  const failed = { value: false };

  const getRouter = async () => (router ??= await (await fetch(`${base}demo/router.json`)).json());
  const getWeights = async (p) => {
    if (!weights.has(p.domain)) weights.set(p.domain, fetch(`${base}${p.weights}`).then((r) => r.json()));
    return weights.get(p.domain);
  };

  let seq = 0;
  async function run() {
    const mine = ++seq;
    const text = input.value;
    try {
      const plugins = await getRouter();
      const r = route(text, plugins);
      if (r.plugin && !weights.has(r.plugin.domain)) {
        consoleEl.dataset.state = "loading";
        resultEl.setAttribute("aria-busy", "true");
      }
      const w = r.plugin ? await getWeights(r.plugin) : null;
      if (mine !== seq) return;
      const t0 = performance.now();
      const answers = [];
      if (r.plugin) {
        for (const q of r.plugin.questions) {
          const p = predict(text, w, q);
          answers.push({ question: q, primary: q === r.plugin.primary, decision: p.decision, confidence: p.confidence, probabilities: p.probabilities });
        }
        answers.sort((a, b) => Number(b.primary) - Number(a.primary));
      }
      const ms = performance.now() - t0;
      resultEl.innerHTML = renderResult(S, {
        route: { domain: r.domain, plugin: r.plugin, confidence: r.confidence, threshold: r.threshold, scores: r.scores },
        answers,
        ms,
        modelId: r.plugin ? `${r.plugin.name}@${r.plugin.version}+nano` : null,
      });
      failed.value = false;
    } catch (err) {
      console.error(err);
      if (mine === seq) resultEl.innerHTML = `<p class="route-msg">${S.error}</p>`;
    } finally {
      if (mine === seq) {
        consoleEl.dataset.state = "ready";
        resultEl.removeAttribute("aria-busy");
      }
    }
  }

  let timer;
  input.addEventListener("input", () => {
    $$(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    clearTimeout(timer);
    timer = setTimeout(run, 140);
  });
  const samples = Object.fromEntries((cfg.samples ?? []).map((s) => [s.id, s.text]));
  $$(".chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(samples[chip.dataset.sample] === input.value));
    chip.addEventListener("click", () => {
      input.value = samples[chip.dataset.sample];
      $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      run();
    });
  });
  // Warm the cache while the browser is idle so the first click is instant.
  const warm = () => getRouter().then((ps) => ps.slice(0, 4).forEach(getWeights)).catch(() => {});
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);
}

// ---------- Legal modal ----------
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-legal-open]");
  if (!link) return;
  const dlg = document.getElementById("legal-dialog");
  if (dlg && typeof dlg.showModal === "function") {
    e.preventDefault();
    if (!dlg.open) dlg.showModal();
  }
});

// ---------- Hosted API demo (quickstart tab) ----------
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-hosted-form]");
  if (!form) return;
  e.preventDefault();
  const ta = form.querySelector("textarea");
  const oi = form.querySelector("#hosted-options");
  const out = form.querySelector("#hosted-out");
  if (!ta || !out) return;
  const options = (oi?.value ?? "").split(",").map((o) => o.trim()).filter(Boolean).slice(0, 8);
  if (options.length < 2) { out.textContent = "2+ options"; return; }
  out.textContent = "…";
  const t0 = performance.now();
  try {
    // Même origine par défaut : le routing Cloudflare envoie /api/* vers Vercel.
    // Surcouché au build via data-api sur le <form> (voir page.mjs / ctx.apiUrl).
    const apiUrl = form.dataset.api || "/api/systemone";
    const r = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: ta.value.slice(0, 2000),
        questions: { q: { type: "choice", instructions: "Pick one.", options } },
      }),
    });
    const d = await r.json();
    const ms = Math.round(performance.now() - t0);
    const a = d.answers?.q;
    if (!a) {
      out.textContent = `HTTP ${r.status}`;
      return;
    }
    const pct = Math.round((a.confidence ?? 0) * 100);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    out.innerHTML =
      `<span class="hosted-dec">${esc(a.choice ?? a.decision)}</span>` +
      `<span class="bar" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></span>` +
      `<span class="muted">${esc(a.confidence ?? "")} · ${ms} ms · ${esc(d.model ?? "")}</span>`;
  } catch {
    out.textContent = "API unreachable";
  }
});
