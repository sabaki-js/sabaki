// Language-neutral facts, all taken from the sabaki-js repositories
// (org README, sabaki/GUIDE.md, sabaki/ROADMAP.md, plugin READMEs and manifests).

export const URLS = {
  github: "https://github.com/sabaki-js",
  repo: "https://github.com/sabaki-js/sabaki",
  npm: "https://www.npmjs.com/package/sabaki",
  guide: "https://github.com/sabaki-js/sabaki/blob/main/GUIDE.md",
  roadmap: "https://github.com/sabaki-js/sabaki/blob/main/ROADMAP.md",
  models: "https://github.com/sabaki-js/sabaki-models",
  template: "https://github.com/sabaki-js/plugin-template",
  doom: "https://github.com/sabaki-js/plugin-doom",
  doomDemo: "https://github.com/sabaki-js/plugin-doom/blob/main/assets/demo_full.gif",
  doomRepo: "https://github.com/sabaki-js/plugin-doom",
  systemOne: "https://docs.typesafe.ai/concepts/system-one",
  paperPdf: "/assets/paper/sabaki-organizational-moe-typed-decisions.pdf",
  paperPdfFr: "/assets/paper/sabaki-organizational-moe-typed-decisions-fr.pdf",
  mit: "https://opensource.org/licenses/MIT",
};

/** Plugin ledger. `q` = [question, nano score, mini score | null]. */
export const PLUGINS = [
  {
    pkg: "@sabaki-js/customer-service", repo: "plugin-customer-service", kb: "548 KB",
    q: [["category", "0.900", "0.91"], ["needs_human", "0.72"], ["urgency", "0.64"], ["churn_risk", "0.60"], ["action", "0.57"]],
  },
  {
    pkg: "@sabaki-js/invoice-processing", repo: "plugin-invoice-processing", kb: "20 KB",
    q: [["duplicate", "0.89", "0.89"], ["matches_order", "0.66"], ["urgency", "0.63"], ["discrepancy_severity", "0.55"], ["disposition", "0.52"]],
  },
  {
    pkg: "@sabaki-js/security-incidents", repo: "plugin-security-incidents", kb: "476 KB",
    q: [["true_positive", "0.77"], ["disposition", "0.73", "0.76"], ["credential_compromise", "0.73"], ["severity", "0.63"], ["urgency", "0.57"]],
  },
  {
    pkg: "@sabaki-js/agent-trace-observability", repo: "plugin-agent-trace-observability", kb: "48 KB",
    q: [["needs_review", "0.59", "0.82"], ["risk", "0.43"], ["urgency", "0.39"], ["action", "0.36"], ["outcome", "0.34"]],
  },
  {
    pkg: "@sabaki-js/mail", repo: "plugin-mail", kb: "655 KB",
    q: [["bucket", "0.889"], ["suspicious", null]],
  },
  {
    pkg: "@sabaki-js/doom", repo: "plugin-doom", kb: "5 KB",
    q: [["command", null], ["target", null], ["weapon", null]],
  },
  {
    pkg: "@sabaki-js/plugin-template", repo: "plugin-template", kb: null,
    q: [],
  },
];

/** Typed-decisions benchmark, test splits (org README).
 *  NB: the generalist row is its own mix val (internal), NOT this test split. */
export const BENCH = [
  { name: "OpenDecider-nano", score: 0.796, sabaki: false },
  { name: "Laya typed-decisions", score: 0.766, sabaki: false },
  { name: "TypeSafe Jev", score: 0.754, sabaki: false },
  { name: "sabaki mini", score: 0.69, sabaki: true },
  { name: "sabaki nano", score: 0.61, sabaki: true },
  { name: "Laya base", score: 0.362, sabaki: false },
];

/** Generalist generations (held-out evals; preliminary until v1). */
export const TRACK = [
  { gen: "v4", mix: "0.848", phish: "R=0.026", td: "0.29" },
  { gen: "v5", mix: "0.838", phish: "R=0.066", td: "—" },
  { gen: "A (22M, 80k)", mix: "0.898", phish: "R=0.406", td: "0.546" },
  { gen: "mini v1.0.0 (served)", mix: "0.756", phish: "R=0.616", td: "0.536" },
  { gen: "B (144M, 80k, scratch)", mix: "0.692", phish: "R=0.062", td: "0.568" },
  { gen: "multi v8 (117M, non-latin fallback)", mix: "0.554", phish: "R=0.736", td: "0.31" },
];

/** Same-size open decision models (144–151M), reference only. Figures self-reported. */
export const PEERS = [
  { name: "openJev-verdict-2.0", size: "151M", lang: "en", url: "https://github.com/Heman10x-NGU/openJev-verdict-2.0" },
  { name: "julia-1", size: "144M", lang: "multilingual", url: "https://huggingface.co/SupersonicLabs/Julia-1" },
  { name: "Open Jev", size: "150M", lang: "en", url: "https://github.com/intikhab49/open-jev-typed-decision-engine" },
  { name: "Phocinae / Largha-150M", size: "144M", lang: "en + zh", url: "https://github.com/Phocinae/Phocinae-Largha-150M-v1" },
  { name: "WaterSheep", size: "base", lang: "en", url: "https://github.com/SamratDuttaOfficial/WaterSheep" },
  { name: "Vela", size: "0.3B–9B", lang: "17 languages", url: "https://huggingface.co/vllm-sr/Vela-2.0-0.3B" },
];

/** CPU latency ruler (log scale). `ms` is where the bar ends; `label` is the published figure. */
export const LATENCY = [
  { name: "sabaki nano", ms: 1, label: "< 1 ms", sabaki: true },
  { name: "sabaki mini", ms: 20, label: "about 20 ms", labelFr: "environ 20 ms", sabaki: true },
  { name: "sabaki generalist", ms: 28, label: "20 to 36 ms", labelFr: "20 à 36 ms", sabaki: true },
  { name: "Laya, 421M", ms: 25000, label: "about 25 s per state", labelFr: "environ 25 s par état", sabaki: false },
];

/** Per-workflow accuracy of the primary question, nano vs mini (GUIDE section 5). */
export const WORKFLOWS = [
  { wf: "customer_service", q: "category", nano: "0.900", mini: "0.91" },
  { wf: "invoice_processing", q: "duplicate", nano: "0.890", mini: "0.89" },
  { wf: "security_incidents", q: "disposition", nano: "0.730", mini: "0.76" },
  { wf: "agent_trace", q: "needs_review", nano: "0.590", mini: "0.82" },
];

/** Demo console samples. Results are computed at build time with the real weights. */
export const SAMPLES = [
  { id: "billing", text: "Customer ticket: I was charged twice for my subscription, billing error on my account, please refund" },
  { id: "security", text: "Security alert: impossible travel login, credential compromise suspected on an active account, severity high" },
  { id: "invoice", text: "Invoice amount differs from the order: currency mismatch, discount not applied, delivery accepted, approve with condition" },
  { id: "agent", text: "Agent trace: tool actions continue after the duration limit, repeated failures, constraint exceeded, escalate to a human" },
  { id: "unrelated", text: "Give me a recipe for dragon stew" },
];

/** Mascot slots: file, intrinsic size (must match the generated image). */
export const MASCOTS = {
  hero: { file: "hero.svg", w: 600, h: 600 },
  router: { file: "router.svg", w: 1200, h: 900 },
  nano: { file: "nano.svg", w: 800, h: 800 },
  mini: { file: "mini.svg", w: 800, h: 800 },
  bunkitsu: { file: "bunkitsu.svg", w: 1466, h: 818 },
  generalist: { file: "generalist.svg", w: 800, h: 800 },
  plugins: { file: "plugins.svg", w: 1200, h: 900 },
  unknown: { file: "unknown.svg", w: 800, h: 800 },
  cpuSleep: { file: "cpu-sleep.svg", w: 1200, h: 900 },
};
