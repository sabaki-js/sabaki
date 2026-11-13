// All visible copy, English and French. Strings may contain trusted inline HTML
// (<code>, <a>). French typography (non-breaking spaces before : ; ! ?) is applied
// automatically at the bottom of this file.

const en = {
  lang: "en",
  locale: "en_US",
  htmlLang: "en",
  switchLabel: "Français",
  switchTitle: "Lire cette page en français",
  skip: "Skip to content",
  meta: {
    title: "Sabaki: typed decisions on CPU, in milliseconds (npm)",
    description:
      "Sabaki routes text to tiny classifiers and returns typed answers with calibrated confidence. Nano under 1 ms, mini about 20 ms, ONNX int8, no GPU or API key.",
    ogAlt: "Sabaki logo, an orange shiba inu, next to the headline: typed decisions on CPU, in milliseconds.",
    keywords:
      "sabaki, typed decisions, text classification, ONNX int8 quantization, nano models, plugin router, CPU inference, MiniLM, TF-IDF, System One, Jev compatible, npm",
  },
  nav: {
    label: "Main",
    how: "How it works",
    models: "Models",
    plugins: "Plugins",
    bunkitsu: "Bunkitsu",
    benchmarks: "Benchmarks",
    paper: "Paper",
    quickstart: "Quickstart",
    faq: "FAQ",
    docs: "Docs",
  },
  links: { github: "GitHub", npm: "npm", guide: "Read the guide" },

  hero: {
    h1: "Typed decisions on CPU, in milliseconds.",
    lede:
      "Sabaki sends a piece of text to the right tiny classifier and returns a typed answer, a choice, a score or a yes/no, with a calibrated confidence. No GPU, no API key, no per-call cost.",
    installLabel: "Install",
    copy: "Copy",
    copied: "Copied",
    facts: [
      "MIT license",
      "No runtime dependencies in nano mode",
      "Serves a Jev-compatible System One HTTP endpoint",
    ],
  },

  console: {
    title: "Try it. It runs in your browser.",
    liveApi: "Try the live API",
    label: "Text to decide on",
    samplesLabel: "Examples",
    samples: {
      billing: "Billing ticket",
      security: "Security alert",
      invoice: "Invoice mismatch",
      agent: "Agent trace",
      unrelated: "Unrelated text",
    },
    routerTitle: "Router",
    routed: "Picked <code>{name}</code> with a score of {score} (threshold {thr}).",
    unknown:
      "No plugin passed the threshold of {thr}. Sabaki returns <code>null</code> instead of guessing. A generalist fallback would answer here.",
    answersTitle: "Typed answers",
    colQuestion: "Question",
    colAnswer: "Answer",
    colConfidence: "Confidence",
    primary: "primary",
    automate: "automate",
    review: "review",
    verdictOk: "Confidence {c} is above 0.8: safe to automate.",
    verdictLow: "Confidence {c} is below 0.8: hand it to a person or ask the mini model.",
    timingOne: "Routed and answered 1 question in {ms} ms, in your browser.",
    timingMany: "Routed and answered {n} questions in {ms} ms, in your browser.",
    staticOne: "Routed and answered 1 question at build time, with the same code.",
    staticMany: "Routed and answered {n} questions at build time, with the same code.",
    decimal: ".",
    loading: "Loading the weights for this domain, once…",
    error: "Could not load the demo weights. The page still works without them.",
    json: "Show the JSON",
    note:
      "These are the real nano weights of the sabaki-js plugins, run by a port of the library’s own router and predictor. Nothing leaves this page. The plugins were trained on the benchmark’s structured English states, so free text earns modest confidence, which is exactly what the number is for.",
    noscript: "Enable JavaScript to try your own text. The result above was computed at build time.",
    mascotAlt: "Shiba inu mascot peeking over the decision console",
  },

  speed: {
    title: "Fast enough for a game loop",
    stats: [
      { n: "< 1 ms", l: "per decision with nano, on a CPU" },
      { n: "12–18k", l: "nano requests per second on one thread" },
      { n: "~20 ms", l: "per decision with mini, int8 ONNX" },
      { n: "22 MB", l: "for a mini model, down from 90 MB" },
      { n: "0", l: "GPUs, API keys or per-call fees" },
    ],
    foot: "Measured by the Sabaki authors on an Intel i5 and a Xeon, one thread. The benchmark script is in the plugin-doom repository.",
    mascotAlt: "Shiba inu mascot sleeping peacefully on a CPU chip",
  },

  approach: {
    h2: "A different way to ship AI decisions",
    lede:
      "A large language model is often used only to pick a label. Sabaki treats that as a classification problem and solves it with models of a few megabytes.",
    items: [
      {
        h: "Answers, not essays",
        p: "Sabaki never writes text. It answers typed questions: a choice among options, a score, or a yes/no probability. Each answer takes one forward pass, so there are no tokens to sample and nothing to parse.",
      },
      {
        h: "Plugins instead of one giant model",
        p: "A router scores the plugins by keyword overlap and sends the text to the best one. Each plugin is its own npm package, trained, versioned and shipped on its own. It is a mixture of experts at system level: a coarser gate than a jointly trained one, and much simpler to operate.",
      },
      {
        h: "Small enough to run anywhere",
        p: "Nano is a TF-IDF classifier of 20 to 650 KB with no dependencies. Mini is a fine-tuned MiniLM quantized to int8 ONNX, 22 MB. Both run on a regular CPU, inside your own process.",
      },
      {
        h: "It knows when it doesn’t know",
        p: "An unknown topic returns <code>null</code>, never a guess. Mini shows healthy doubt on out-of-distribution input (0.2 to 0.5 confidence on dragons, recipes and empty strings), which is what makes a rule like “automate above 0.8” safe.",
      },
    ],
    mascotAlt: "Shiba inu mascot shrugging, a question mark above its head",
  },

  how: {
    h2: "How a decision is made",
    lede:
      "Sabaki follows the System One contract defined by TypeSafe, where models return typed answers and probabilities instead of generated text (<a href=\"__SYSTEMONE__\" rel=\"noopener\">System One docs</a>).",
    steps: [
      {
        h: "Route",
        p: "The router lowercases the text, strips accents and counts keyword hits for each plugin. The score is hits divided by the square root of the keyword count. Below the plugin’s threshold (0.15 by default) the domain is unknown.",
      },
      {
        h: "Decide",
        p: "The winning plugin answers with nano (under 1 ms) or mini (about 20 ms). If no specialist wins, the optional generalist cross-encoder answers instead, reading questions you define at runtime.",
      },
      {
        h: "Answer",
        p: "You get typed answers with probabilities, in the Jev shape. The <code>model</code> field names the model that really answered. Over HTTP it is <code>POST /v1/systemone</code>.",
      },
    ],
    diagramTitle: "Routing flow of a Sabaki decision",
    diagramDesc:
      "A state and its questions go to the router. A winning specialist plugin answers with nano or mini. When the domain is unknown, the generalist fallback answers. Both produce typed answers, served at POST /v1/systemone.",
    d: {
      state: "State and questions",
      stateSub: "any text",
      router: "Router",
      routerSub: "hits / sqrt(keywords)",
      specialist: "Specialist plugin",
      specialistSub: "nano < 1 ms, mini ~20 ms",
      generalist: "Generalist fallback",
      generalistSub: "reads runtime questions",
      answers: "Typed answers",
      answersSub: "choice, score, noul",
      http: "POST /v1/systemone",
      wins: "specialist wins",
      unknown: "unknown",
    },
    mascotAlt: "Shiba inu mascot directing envelopes into three different tunnels",
  },

  models: {
    h2: "Three model sizes, one interface",
    lede: "Every plugin speaks the same interface, so you can start with nano and move a domain to mini when it needs more accuracy.",
    rows: [
      {
        id: "nano",
        h: "nano",
        sub: "TF-IDF and logistic regression",
        facts: [
          ["Weights", "20 to 650 KB"],
          ["Latency", "under 1 ms"],
          ["Dependencies", "none"],
          ["Accuracy", "0.34 to 0.90 per question"],
        ],
        p: "Pure TypeScript with exact scikit-learn parity, checked on 20 questions. It is not autoregressive: one pass, no tokens generated.",
        alt: "Tiny shiba inu puppy standing on a coin, a feather on its back",
      },
      {
        id: "mini",
        h: "mini",
        sub: "MiniLM-L6, fine-tuned per domain",
        facts: [
          ["Weights", "22 MB, int8 ONNX"],
          ["Latency", "10 to 25 ms"],
          ["Dependencies", "onnxruntime-node, optional"],
          ["Calibration", "ECE below 0.16"],
        ],
        p: "One multi-task model per domain: a shared encoder with one linear head per question. Weights download once from the sabaki-models releases, are SHA256-verified and cached in <code>~/.cache/sabaki</code>.",
        alt: "Shiba inu mascot wearing a small toolbelt and holding a magnifying glass",
      },
      {
        id: "generalist",
        alt: "Shiba inu mascot reading an open question scroll",
        h: "generalist",
        sub: "Cross-encoder for open questions",
        facts: [
          ["Weights", "22M parameters"],
          ["Latency", "20 to 36 ms"],
          ["Dependencies", "onnxruntime-node"],
          ["Status", "mini served (mix val 0.756, phishing R=0.616, 0.536 on typed-decisions test)"],
        ],
        p: "Answers anything: you pass instructions and up to 8 candidate options at runtime. It is the fallback when no specialist wins routing, and it never overrides one.",
      },
    ],
    base: "A larger <code>base</code> mode for hard tasks is under evaluation.",
    quantH: "ONNX int8 quantization, measured",
    quantP:
      "Dynamic int8 quantization shrinks a mini model from about 90 MB to 22 MB. On the customer-service benchmark it cost 0.004 of accuracy and left calibration unchanged or better. Every export is re-measured.",
    quantBars: [
      { l: "fp32 ONNX", v: "about 90 MB", w: 100 },
      { l: "int8 ONNX", v: "22 MB", w: 24 },
    ],
    quantAria: "Model size: fp32 about 90 megabytes, int8 22 megabytes",
    ftH: "Fine-tuning beat the shortcuts",
    ftP:
      "Fine-tuning the whole encoder scored 0.68 against 0.65 for a frozen encoder with MLP heads. Distilling a 400M teacher into frozen embeddings was tried and dropped.",
    recipeSummary: "How plugins are trained",
    recipeNano: "A nano plugin",
    recipeNanoSteps: [
      "Collect (text, label) pairs from public datasets or your own exports.",
      "Split deterministically: every fifth item is test, stratified across time. Training on the first items only inflated one score to 0.93, against 0.52 out of split.",
      "Fit TF-IDF (unigrams and bigrams, 3000 to 6000 features) and a logistic regression. Round coefficients to 1e-4.",
      "Export vocabulary, IDF and coefficients as JSON.",
      "Report accuracy and ECE on the held-out split in the plugin README.",
    ],
    recipeMini: "A mini plugin",
    recipeMiniSteps: [
      "Fine-tune MiniLM-L6 end to end for 8 to 12 epochs at 2e-5 on a CUDA GPU, one head per question.",
      "Export to ONNX and verify exact parity.",
      "Quantize to int8, then re-measure accuracy and ECE.",
    ],
    privacy:
      "Privacy comes first: anonymize before training. On email, removing every personal term from the vocabulary cost 0.024 of accuracy.",
  },

  plugins: {
    h2: "Plugins: one npm package per domain",
    lede:
      "Each plugin ships its own nano weights and manifest. The four benchmark plugins also have a fine-tuned mini model, which shows how far a small specialist goes.",
    cols: { pkg: "Package", decides: "Decides", scores: "Questions and accuracy", size: "Weights" },
    caption: "Held-out accuracy of the nano model, with the mini score where one exists.",
    miniTag: "mini",
    rows: {
      "@sabaki-js/customer-service": "Support tickets",
      "@sabaki-js/invoice-processing": "Invoices, orders and deliveries",
      "@sabaki-js/security-incidents": "Security incident triage",
      "@sabaki-js/agent-trace-observability": "AI agent traces",
      "@sabaki-js/mail": "Email triage in 8 buckets, plus phishing suspicion. The bucket score is 0.889 on test and 0.769 end to end; suspicion is experimental.",
      "@sabaki-js/doom": "Doom navigation and combat decisions. Work in progress.",
      "@sabaki-js/plugin-template": "Starter for your own plugin.",
    },
    ownH: "Write a plugin in a few lines",
    ownP:
      "A plugin is a manifest and a <code>classify</code> function. The <code>threshold</code> field sets the share of matched keywords below which the router says unknown.",
    ownList: [
      "<code>definePlugin</code>: any logic, no training.",
      "<code>nanoClassifier</code>: bundled TF-IDF weights.",
      "<code>miniClassifier</code>: a downloaded ONNX model.",
      "<code>autoClassifier</code>: mini when it loads, nano otherwise.",
    ],
    template: "Start from the plugin template",
    doomH: "A 35 Hz game loop on a CPU",
    doomP:
      "To prove the latency, Sabaki plays Doom. The game runs in Python (ViZDoom) and calls a JavaScript decision server once per tick. Mini serves about 71 requests per second on one thread and nano about 18,000, so a 35 Hz tick fits on any CPU. With an exit compass, mini reaches the exit of the first level in 2 to 4 of 6 runs; nano manages none, because text states lose spatial information. How it plays: each tick, sensors serialize the game into text plus an exit compass line; the model answers <code>command</code>, <code>target</code>, <code>weapon</code> over HTTP; a scripted executor (A* waypoints, door approach, 15-tick open-door latch) turns the command into Doom inputs. The model decides, the executor drives. It is a stress test, not a product.",
    doomLink: "Watch the run",
    wfTitle: "Workflow technical details",
    wfSteps: [
      "Sensors read engine internals every tick: labels buffer (per-object segmentation), sectors, positions.",
      "doomlib serializes the state to text plus one compass line (exit distance and bearing).",
      "The MiniLM model answers command, target and weapon over HTTP (/v1/systemone).",
      "The scripted executor (A* waypoints, door approach, 15-tick open-door latch) turns the command into the 14 game inputs.",
      "No vision model on this path; a separate 1.1M SFT head plays from pixels in arenas. No RL anywhere.",
    ],
    mascotAlt: "Shiba inu mascot plugging a puzzle-piece plug into a socket",
  },

  bench: {
    h2: "Benchmarks, trade-offs included",
    lede:
      "On the typed-decisions benchmark, Sabaki gives up a few points of score for about 1000 times lower latency, measured against the 421M Laya model on a CPU.",
    chartTitle: "Score on the typed-decisions test splits",
    chartAria: "Bar chart of benchmark scores, from OpenDecider-nano at 0.796 down to Laya base at 0.362",
    peersTitle: "Larger open decision models (144-151M), for reference",
    trackTitle: "Generalist generations (preliminary)",
    trackCols: { gen: "Generation", mix: "Mix val", phish: "PhishNChips recall", td: "typed-decisions test" },
    trackNote: "Preliminary numbers while v6 trains: mix val is each run's own split (not comparable across rows); PhishNChips (2,000 held-out emails) and the typed-decisions test split are identical for every row. *n=200 subset.",
    peersNote: "sabaki generalist is 22.7M - about 6.5x smaller than the smallest model listed here, and the smallest general-purpose decision model in the list. Figures are self-reported by each author; protocols differ.",
    tags: {
      "OpenDecider-nano": "400M, GPU",
      "Laya typed-decisions": "421M, CPU about 25 s",
      "TypeSafe Jev": "API only",
      "sabaki mini": "22M int8, about 20 ms",
      "sabaki nano": "TF-IDF, under 1 ms",
      "sabaki generalist": "22M, mix val (own split, not test)",
      "Laya base": "421M, zero-shot",
    },
    latencyTitle: "CPU latency per decision, log scale",
    latencyAria: "Horizontal bars on a log scale: nano under 1 ms, mini about 20 ms, Laya about 25 seconds",
    foot:
      "Scores for OpenDecider-nano, Laya and Jev are published numbers, not re-measured. The 25 s figure for Laya comes from the Sabaki authors’ CPU test of an ONNX port. The served generalist (mini, 22.7M) scores 0.536 on the typed-decisions test split (v4 scored 0.29); its 0.756 is its own mix validation — so it stays out of the chart above until the v1 numbers land.",
    wfTitle: "Nano against mini, per workflow",
    wfCols: { wf: "Workflow", q: "Primary question", nano: "nano", mini: "mini" },
    wfFoot: "Temporal split (generation batches kept apart): 300 train and 100 test states per workflow. On email, nano scores 0.865 with all personal terms removed, and MiniLM only ties TF-IDF (within 0.02), so nano ships.",
  },

  compare: {
    h2: "How Sabaki compares",
    lede: "Against large typed-decision models, the trade is a few points of score for a model you can run anywhere.",
    cols: { what: "", sabaki: "Sabaki", big: "Large typed-decision models" },
    rows: [
      ["Model size", "Kilobytes of weights (nano), 22M int8 (mini)", "400M to 421M parameters (OpenDecider-nano, Laya)"],
      ["Where it runs", "Any CPU, inside your process", "A GPU, or a hosted API (Jev)"],
      ["CPU latency", "Under 1 ms (nano), about 20 ms (mini)", "About 25 s per state for Laya"],
      ["Benchmark score", "0.61 (nano), 0.69 (mini)", "0.754 to 0.796"],
      ["Cost per call", "None", "GPU time or API fees"],
    ],
    llm:
      "A general LLM does far more, and you should use one when you need text, reasoning or open-ended answers. Sabaki is for the narrow case where you need a label in milliseconds, locally, with a confidence you can threshold.",
    contrast: [
      { h: "Plugins", p: "Domain experts are separate packages, so you install only the ones you route to." },
      { h: "ONNX int8 quantization", p: "A mini model ships at about a quarter of its original size, for a cost of 0.004 accuracy." },
      { h: "Nano models", p: "A classifier of kilobytes covers the cases where a bigger model adds little. On email, MiniLM tied TF-IDF, so nano ships." },
    ],
  },

  paper: {
    h2: "Research paper",
    lede: "The design, measurements and trade-offs behind Sabaki, written up as a scientific paper.",
    status: "Preprint v1 — October 2026",
    title: "Sabaki: An Organizational Mixture-of-Experts for Typed Decisions on CPU",
    authors: "Fox3000foxy, Independent Researcher",
    body: "Large language models are routinely invoked for tasks that are, at their core, classification. Sabaki replaces the single-model call with an organizational mixture-of-experts: a keyword- and language-aware router dispatches each input to a small, independently trained classifier plugin (nano TF-IDF, under 1 ms; mini MiniLM ONNX, about 20 ms on CPU; or a cross-encoder fallback) which returns a typed answer with calibrated confidence. On the public typed-decisions split it scores 0.61 (nano) and 0.69 (mini) against 0.75–0.80 for models needing a GPU or an API, for millisecond CPU latency instead of API round-trips (competitor latencies were never measured).",
    readPdf: "Read the PDF (v1)",
    release: "Release notes",
    source: "LaTeX sources",
    cite: "Cite",
    bib: "@misc{sabaki2026orgmoe,\n  title  = {Sabaki: An Organizational Mixture-of-Experts for Typed Decisions on CPU},\n  author = {Fox3000foxy},\n  year   = {2026},\n  note   = {Preprint v1, October 2026},\n  url    = {https://sabaki.fox3000foxy.com/assets/paper/sabaki-organizational-moe-typed-decisions.pdf}\n}",
  },

  quick: {
    h2: "Quickstart",
    lede: "Start with nano. It is synchronous, bundled and needs nothing else.",
    tabsLabel: "Quickstart variants",
    tabs: [
      { id: "nano", label: "Nano" },
      { id: "mini", label: "Mini" },
      { id: "fallback", label: "Generalist fallback" },
      { id: "http", label: "HTTP" },
      { id: "hosted", label: "Hosted API" },
    ],
    intro: {
      nano: "Register a plugin and call <code>decide</code>. Pass <code>question</code> to ask something other than the primary question.",
      mini: "Mini loads an ONNX model on first use and needs <code>onnxruntime-node</code>. Use the async path and a confidence threshold.",
      fallback:
        "The generalist answers when no specialist wins routing. Point <code>SABAKI_GENERALIST_DIR</code> at a directory holding <code>generalist.onnx</code> and <code>tokenizer/tokenizer.json</code>. It is still training.",
      http: "A Jev-compatible server ships as an example in the repository. It is a development tool: add authentication before exposing it.",
      hosted: "No setup wanted? No panic! We host a free instance, always up to date, right here. Try it with the form below:",
    },
    hostedBtn: "Decide",
    hostedApi: "Or call it yourself:",
    hostedOpts: "Options, comma-separated:",
    hostedPh: "A state to decide on…",
    hostedWait: "Deciding…",
    hostedErr: "API unreachable, try again later.",
    copy: "Copy",
    copied: "Copied",
    result: "Result",
  },

  bunkitsu: {
    metaTitle: "Bunkitsu: batch CSV decisions with Sabaki plugins",
    metaDesc:
      "Bunkitsu resolves a CSV file row by row through Sabaki plugins and writes decisions, confidence and probabilities back to CSV. No GPU, no API key.",
    h1: "Batch decisions over CSV.",
    lede:
      "Bunkitsu feeds every row of a CSV file to the Sabaki router — nano, mini and cross-encoder plugins, language-aware fallback — and writes the decision back. Thousands of rows, same millisecond engine, fully traceable.",
    install: "npm i sabaki",
    cmd: "npx bunkitsu resolve input.csv --out results.csv --plugin ./mon-plugin",
    inH: "Input columns",
    inRows: [
      ["state", "the text to decide on"],
      ["question", "the typed question (e.g. suspicious, jailbreak?)"],
      ["type", "choice, noul or score"],
      ["options", "pipe-separated options for choice (empty for noul)"],
    ],
    outH: "Output columns",
    outRows: [
      ["state, question, type", "echoed"],
      ["decision, confidence", "the winning option and its probability"],
      ["probs", "full option → probability map (JSON)"],
      ["domain, model", "which plugin and model answered (traceability)"],
    ],
    exampleH: "Example",
    zhNote: "Non-latin scripts are routed to the multilingual backend:",
    exampleNote: "Each row is routed independently — phishing to the phishing mini, jailbreak attempts to the jailbreak plugin, anything else to the language-dispatched generalist fallback.",
    bandTitle: "Need thousands of decisions, not one?",
    bandLede: "Bunkitsu resolves whole CSV files through the same router and plugins.",
    bandLink: "See how Bunkitsu works",
    mascotAlt: "Shiba Inu stamping stacked CSV sheets",
  },

  honest: {
    h2: "What is not ready yet",
    lede: "The repository is candid about its gaps, and so is this page.",
    items: [
      "The served generalist is mini (22.7M, from scratch on the full v6 mix): 0.756 on its own mix validation, phishing recall 0.616 on 2,000 held-out emails, 0.536 on the public typed-decisions test split.",
      "A larger base mode for hard tasks is under evaluation.",
      "Nano is weakest on agent traces (0.34 to 0.59). Mini lifts <code>needs_review</code> to 0.82.",
      "Doom text states plateau around 0.57, so only the mini navigation run finishes the level.",
      "The benchmark plugins are trained on English text, and the mail plugin on a mostly French mailbox. Multilingual training is planned if there is demand.",
      "The HTTP server is a development tool. Add authentication before exposing it.",
      "Shipped: per-question temperature scaling. Planned: a CLI and plugin hub (<code>bunkitsu</code>).",
    ],
    roadmap: "Read the full roadmap",
  },

  faq: {
    h2: "Frequently asked questions",
    items: [
      {
        q: "What is Sabaki?",
        a: "Sabaki is a TypeScript library that routes a piece of text to the right tiny classifier plugin and returns a typed answer (a choice, a score or a yes/no) with a calibrated confidence. It runs on a CPU, in milliseconds.",
      },
      {
        q: "How is it different from a large language model?",
        a: "It does not generate text. It answers typed questions in one forward pass, so you get a label and a confidence in about 1 ms (nano) or 20 ms (mini) with nothing to parse. Use an LLM when you need text or reasoning, and Sabaki when you need a decision.",
      },
      {
        q: "Do I need a GPU or an API key?",
        a: "No. Nano has no runtime dependencies. Mini runs through the optional onnxruntime-node package on a normal CPU. There is no per-call cost.",
      },
      {
        q: "How accurate is it?",
        a: "On the typed-decisions benchmark, mini scores 0.69 and nano 0.61, against 0.754 to 0.796 for models that need a GPU or an API. Confidence is calibrated (ECE below 0.16 for mini), so you can automate above a threshold such as 0.8 and escalate the rest.",
      },
      {
        q: "What is the difference between nano, mini and the generalist?",
        a: "Nano is a TF-IDF and logistic regression classifier of kilobytes. Mini is a fine-tuned MiniLM quantized to int8 ONNX, 22 MB. The generalist is a cross-encoder that answers questions you define at runtime, used as the fallback when no specialist matches.",
      },
      {
        q: "Is it compatible with Jev and System One?",
        a: "Sabaki serves a Jev-compatible subset of the System One contract over HTTP: POST /v1/systemone, GET /health and GET /v1/models. The model field names the model that actually answered.",
      },
      {
        q: "Can I write my own plugin?",
        a: "Yes. A plugin is a manifest and a classify function. Use definePlugin for any logic, nanoClassifier for TF-IDF weights, miniClassifier for an ONNX model, or start from the plugin template.",
      },
      {
        q: "Which languages does it support?",
        a: "The four benchmark plugins are trained on English text and the mail plugin on a mostly French mailbox. Multilingual training is on the roadmap if there is demand.",
      },
      {
        q: "What is the license?",
        a: "MIT. Packages are published to npm with provenance through trusted publishing, and everything runs locally, so your text stays with you.",
      },
    ],
  },

  footer: {
    project: "Project",
    resources: "Resources",
    items: {
      github: "GitHub organization",
      repo: "sabaki on GitHub",
      npm: "sabaki on npm",
      guide: "Guide",
      roadmap: "Roadmap",
      models: "Model weights",
      template: "Plugin template",
      systemOne: "System One docs",
      paper: "Research paper (PDF v1)",
    },
    license: "Released under the MIT license.",
    top: "Back to top",
    legal: "Legal notice",
    legalTitle: "Legal notice",
    legalBody: "Publisher: sabaki-js. Hosting: Cloudflare, Inc. This site collects no personal data: no accounts, no cookies, no analytics, no third-party scripts.",
    close: "Close",
  },

  mascot: {
    note: "",
  },
};

const fr = {
  lang: "fr",
  locale: "fr_FR",
  htmlLang: "fr",
  switchLabel: "English",
  switchTitle: "Read this page in English",
  skip: "Aller au contenu",
  meta: {
    title: "Sabaki : décisions typées sur CPU, en millisecondes (npm)",
    description:
      "Sabaki route un texte vers de petits classifieurs et renvoie une réponse typée avec confiance calibrée. Nano sous 1 ms, mini environ 20 ms, ONNX int8, sans GPU.",
    ogAlt: "Logo Sabaki, un shiba inu orange, à côté du titre : décisions typées sur CPU, en millisecondes.",
    keywords:
      "sabaki, décisions typées, classification de texte, quantification ONNX int8, modèles nano, routeur de greffons, inférence CPU, MiniLM, TF-IDF, System One, compatible Jev, npm",
  },
  nav: {
    label: "Principale",
    how: "Fonctionnement",
    models: "Modèles",
    plugins: "Greffons",
    bunkitsu: "Bunkitsu",
    benchmarks: "Benchmarks",
    paper: "Article",
    quickstart: "Démarrage",
    faq: "FAQ",
    docs: "Docs",
  },
  links: { github: "GitHub", npm: "npm", guide: "Lire le guide" },

  hero: {
    h1: "Des décisions typées sur CPU, en millisecondes.",
    lede:
      "Sabaki envoie un texte au bon petit classifieur et renvoie une réponse typée, un choix, un score ou un oui/non, avec une confiance calibrée. Pas de GPU, pas de clé d’API, pas de coût par appel.",
    installLabel: "Installation",
    copy: "Copier",
    copied: "Copié",
    facts: [
      "Licence MIT",
      "Aucune dépendance d’exécution en mode nano",
      "Sert un endpoint HTTP System One compatible Jev",
    ],
  },

  console: {
    title: "Essayez. Tout tourne dans votre navigateur.",
    liveApi: "Essayer l'API en direct",
    label: "Texte à traiter",
    samplesLabel: "Exemples",
    samples: {
      billing: "Ticket de facturation",
      security: "Alerte de sécurité",
      invoice: "Facture incohérente",
      agent: "Trace d’agent",
      unrelated: "Texte hors sujet",
    },
    routerTitle: "Routeur",
    routed: "A choisi <code>{name}</code> avec un score de {score} (seuil {thr}).",
    unknown:
      "Aucun greffon ne dépasse le seuil de {thr}. Sabaki renvoie <code>null</code> plutôt que de deviner. Un généraliste de repli répondrait ici.",
    answersTitle: "Réponses typées",
    colQuestion: "Question",
    colAnswer: "Réponse",
    colConfidence: "Confiance",
    primary: "principale",
    automate: "automatiser",
    review: "à vérifier",
    verdictOk: "La confiance de {c} dépasse 0,8 : on peut automatiser.",
    verdictLow: "La confiance de {c} est sous 0,8 : passez la main à une personne ou au modèle mini.",
    timingOne: "1 question routée et traitée en {ms} ms, dans votre navigateur.",
    timingMany: "{n} questions routées et traitées en {ms} ms, dans votre navigateur.",
    staticOne: "1 question routée et traitée à la compilation, avec le même code.",
    staticMany: "{n} questions routées et traitées à la compilation, avec le même code.",
    decimal: ",",
    loading: "Chargement des poids de ce domaine, une seule fois…",
    error: "Impossible de charger les poids de démo. La page reste utilisable sans eux.",
    json: "Voir le JSON",
    note:
      "Ce sont les vrais poids nano des greffons sabaki-js, exécutés par un portage du routeur et du prédicteur de la bibliothèque. Rien ne quitte cette page. Les greffons ont été entraînés sur les états structurés en anglais du benchmark : un texte libre obtient donc une confiance modeste, et c’est exactement à cela que sert ce chiffre.",
    noscript: "Activez JavaScript pour tester votre propre texte. Le résultat ci-dessus a été calculé à la compilation.",
    mascotAlt: "Mascotte shiba inu qui jette un œil par-dessus la console de décision",
  },

  speed: {
    title: "Assez rapide pour une boucle de jeu",
    stats: [
      { n: "< 1 ms", l: "par décision avec nano, sur un CPU" },
      { n: "12–18k", l: "requêtes nano par seconde sur un seul thread" },
      { n: "~20 ms", l: "par décision avec mini, ONNX int8" },
      { n: "22 Mo", l: "pour un modèle mini, contre 90 Mo" },
      { n: "0", l: "GPU, clé d’API ou frais par appel" },
    ],
    foot: "Mesuré par les auteurs de Sabaki sur un Intel i5 et un Xeon, un seul thread. Le script de benchmark est dans le dépôt plugin-doom.",
    mascotAlt: "Mascotte shiba inu qui dort paisiblement sur une puce CPU",
  },

  approach: {
    h2: "Une autre façon de livrer des décisions d’IA",
    lede:
      "On sollicite souvent un grand modèle de langage uniquement pour choisir une étiquette. Sabaki traite cela comme un problème de classification et le résout avec des modèles de quelques mégaoctets.",
    items: [
      {
        h: "Des réponses, pas des textes",
        p: "Sabaki n’écrit jamais de texte. Il répond à des questions typées : un choix parmi des options, un score ou une probabilité oui/non. Chaque réponse tient en une passe, donc aucun jeton à échantillonner et rien à analyser.",
      },
      {
        h: "Des greffons plutôt qu’un modèle géant",
        p: "Un routeur note les greffons par recouvrement de mots-clés et envoie le texte au meilleur. Chaque greffon est un paquet npm à part, entraîné, versionné et publié seul. C’est un mélange d’experts à l’échelle du système : une porte plus grossière qu’un entraînement conjoint, mais bien plus simple à exploiter.",
      },
      {
        h: "Assez petit pour tourner partout",
        p: "Nano est un classifieur TF-IDF de 20 à 650 Ko sans dépendance. Mini est un MiniLM affiné puis quantifié en ONNX int8, 22 Mo. Les deux tournent sur un CPU ordinaire, dans votre propre processus.",
      },
      {
        h: "Il sait quand il ne sait pas",
        p: "Un sujet inconnu renvoie <code>null</code>, jamais une supposition. Mini montre un doute sain hors distribution (0,2 à 0,5 de confiance sur des dragons, des recettes et des chaînes vides), ce qui rend sûre une règle comme « automatiser au-dessus de 0,8 ».",
      },
    ],
    mascotAlt: "Mascotte shiba inu qui hausse les épaules, un point d’interrogation au-dessus de la tête",
  },

  how: {
    h2: "Comment une décision est prise",
    lede:
      "Sabaki suit le contrat System One défini par TypeSafe, où les modèles renvoient des réponses typées et des probabilités plutôt que du texte généré (<a href=\"__SYSTEMONE__\" rel=\"noopener\">documentation System One</a>, en anglais).",
    steps: [
      {
        h: "Router",
        p: "Le routeur passe le texte en minuscules, retire les accents et compte les mots-clés trouvés pour chaque greffon. Le score est le nombre de correspondances divisé par la racine carrée du nombre de mots-clés. Sous le seuil du greffon (0,15 par défaut), le domaine est inconnu.",
      },
      {
        h: "Décider",
        p: "Le greffon gagnant répond avec nano (moins de 1 ms) ou mini (environ 20 ms). Si aucun spécialiste ne gagne, le cross-encoder généraliste optionnel répond à sa place, en lisant des questions définies à l’exécution.",
      },
      {
        h: "Répondre",
        p: "Vous obtenez des réponses typées avec leurs probabilités, au format Jev. Le champ <code>model</code> nomme le modèle qui a réellement répondu. En HTTP, c’est <code>POST /v1/systemone</code>.",
      },
    ],
    diagramTitle: "Parcours d’une décision Sabaki",
    diagramDesc:
      "Un état et ses questions arrivent au routeur. Un greffon spécialiste gagnant répond avec nano ou mini. Quand le domaine est inconnu, le généraliste de repli répond. Les deux produisent des réponses typées, servies sur POST /v1/systemone.",
    d: {
      state: "État et questions",
      stateSub: "un texte quelconque",
      router: "Routeur",
      routerSub: "hits / sqrt(mots-clés)",
      specialist: "Greffon spécialiste",
      specialistSub: "nano < 1 ms, mini ~20 ms",
      generalist: "Généraliste de repli",
      generalistSub: "lit des questions libres",
      answers: "Réponses typées",
      answersSub: "choice, score, noul",
      http: "POST /v1/systemone",
      wins: "un spécialiste gagne",
      unknown: "inconnu",
    },
    mascotAlt: "Mascotte shiba inu qui oriente des enveloppes vers trois tunnels différents",
  },

  models: {
    h2: "Trois tailles de modèle, une seule interface",
    lede: "Tous les greffons parlent la même interface : commencez avec nano, puis passez un domaine en mini quand il demande plus de précision.",
    rows: [
      {
        id: "nano",
        h: "nano",
        sub: "TF-IDF et régression logistique",
        facts: [
          ["Poids", "20 à 650 Ko"],
          ["Latence", "moins de 1 ms"],
          ["Dépendances", "aucune"],
          ["Précision", "0,34 à 0,90 par question"],
        ],
        p: "TypeScript pur, à parité exacte avec scikit-learn, vérifiée sur 20 questions. Il n’est pas autorégressif : une passe, aucun jeton généré.",
        alt: "Minuscule chiot shiba inu debout sur une pièce, une plume sur le dos",
      },
      {
        id: "mini",
        h: "mini",
        sub: "MiniLM-L6, affiné par domaine",
        facts: [
          ["Poids", "22 Mo, ONNX int8"],
          ["Latence", "10 à 25 ms"],
          ["Dépendances", "onnxruntime-node, optionnel"],
          ["Calibration", "ECE sous 0,16"],
        ],
        p: "Un modèle multitâche par domaine : un encodeur partagé et une tête linéaire par question. Les poids se téléchargent une fois depuis les releases de sabaki-models, sont vérifiés en SHA256 et mis en cache dans <code>~/.cache/sabaki</code>.",
        alt: "Mascotte shiba inu avec une petite ceinture à outils et une loupe",
      },
      {
        id: "generalist",
        alt: "Mascotte shiba inu lisant un parchemin de question ouverte",
        h: "generalist",
        sub: "Cross-encoder pour les questions ouvertes",
        facts: [
          ["Poids", "22M de paramètres"],
          ["Latence", "20 à 36 ms"],
          ["Dépendances", "onnxruntime-node"],
          ["Statut", "mini servi (0,756 en val mix, R=0,616 phishing, 0,536 sur typed-decisions)"],
        ],
        p: "Répond à tout : vous passez des instructions et jusqu’à 8 options candidates à l’exécution. Il sert de repli quand aucun spécialiste ne gagne le routage, et ne passe jamais devant l’un d’eux.",
      },
    ],
    base: "Un mode <code>base</code> plus gros, pour les tâches difficiles, est en cours d’évaluation.",
    quantH: "Quantification ONNX int8, mesurée",
    quantP:
      "La quantification dynamique int8 réduit un modèle mini d’environ 90 Mo à 22 Mo. Sur le benchmark customer-service, elle a coûté 0,004 de précision et laissé la calibration identique ou meilleure. Chaque export est remesuré.",
    quantBars: [
      { l: "ONNX fp32", v: "environ 90 Mo", w: 100 },
      { l: "ONNX int8", v: "22 Mo", w: 24 },
    ],
    quantAria: "Taille du modèle : fp32 environ 90 mégaoctets, int8 22 mégaoctets",
    ftH: "L’affinage a battu les raccourcis",
    ftP:
      "Affiner tout l’encodeur donne 0,68, contre 0,65 pour un encodeur gelé avec des têtes MLP. Distiller un enseignant de 400M dans des embeddings gelés a été essayé, puis abandonné.",
    recipeSummary: "Comment les greffons sont entraînés",
    recipeNano: "Un greffon nano",
    recipeNanoSteps: [
      "Rassembler des paires (texte, étiquette) depuis des jeux de données publics ou vos propres exports.",
      "Découper de façon déterministe : un élément sur cinq part en test, stratifié dans le temps. Entraîner sur les premiers éléments seulement gonflait un score à 0,93, contre 0,52 hors découpage.",
      "Ajuster un TF-IDF (unigrammes et bigrammes, 3000 à 6000 caractéristiques) et une régression logistique. Arrondir les coefficients à 1e-4.",
      "Exporter vocabulaire, IDF et coefficients en JSON.",
      "Publier précision et ECE sur le jeu de test dans le README du greffon.",
    ],
    recipeMini: "Un greffon mini",
    recipeMiniSteps: [
      "Affiner MiniLM-L6 de bout en bout, 8 à 12 epochs à 2e-5 sur GPU CUDA, une tête par question.",
      "Exporter en ONNX et vérifier la parité exacte.",
      "Quantifier en int8, puis remesurer précision et ECE.",
    ],
    privacy:
      "La confidentialité passe d’abord : anonymisez avant d’entraîner. Sur des e-mails, retirer tous les termes personnels du vocabulaire a coûté 0,024 de précision.",
  },

  plugins: {
    h2: "Greffons : un paquet npm par domaine",
    lede:
      "Chaque greffon embarque ses propres poids nano et son manifeste. Les quatre greffons du benchmark ont aussi un modèle mini affiné, ce qui montre jusqu’où va un petit spécialiste.",
    cols: { pkg: "Paquet", decides: "Décide", scores: "Questions et précision", size: "Poids" },
    caption: "Précision du modèle nano sur le jeu de test, avec le score mini quand il existe.",
    miniTag: "mini",
    rows: {
      "@sabaki-js/customer-service": "Tickets de support",
      "@sabaki-js/invoice-processing": "Factures, commandes et livraisons",
      "@sabaki-js/security-incidents": "Tri des incidents de sécurité",
      "@sabaki-js/agent-trace-observability": "Traces d’agents IA",
      "@sabaki-js/mail": "Tri d’e-mails en 8 catégories, plus soupçon de phishing. Le score de catégorie est 0,889 en test et 0,769 de bout en bout ; le soupçon est expérimental.",
      "@sabaki-js/doom": "Décisions de navigation et de combat dans Doom. En cours de développement.",
      "@sabaki-js/plugin-template": "Point de départ pour votre propre greffon.",
    },
    ownH: "Écrire un greffon en quelques lignes",
    ownP:
      "Un greffon, c’est un manifeste et une fonction <code>classify</code>. Le champ <code>threshold</code> fixe la part de mots-clés trouvés sous laquelle le routeur répond « inconnu ».",
    ownList: [
      "<code>definePlugin</code> : n’importe quelle logique, sans entraînement.",
      "<code>nanoClassifier</code> : poids TF-IDF embarqués.",
      "<code>miniClassifier</code> : un modèle ONNX téléchargé.",
      "<code>autoClassifier</code> : mini s’il se charge, nano sinon.",
    ],
    template: "Partir du modèle de greffon",
    doomH: "Une boucle de jeu à 35 Hz sur un CPU",
    doomP:
      "Pour prouver la latence, Sabaki joue à Doom. Le jeu tourne en Python (ViZDoom) et appelle un serveur de décision JavaScript à chaque tick. Mini sert environ 71 requêtes par seconde sur un thread et nano environ 18 000 : un tick à 35 Hz passe donc sur n’importe quel CPU. Avec une boussole de sortie, mini atteint la sortie du premier niveau dans 2 à 4 parties sur 6 ; nano n’y arrive jamais, car les états en texte perdent l’information spatiale. Comment ça joue : à chaque tick, les capteurs sérialisent le jeu en texte plus une ligne de compas ; le modèle répond <code>command</code>, <code>target</code>, <code>weapon</code> en HTTP ; un exécuteur scripté (waypoints A*, approche des portes, latch d’ouverture 15 ticks) convertit la commande en entrées Doom. Le modèle décide, l’exécuteur conduit. C’est un test de résistance, pas un produit.",
    doomLink: "Voir la partie",
    wfTitle: "Détails techniques du workflow",
    wfSteps: [
      "Les capteurs lisent l'intérieur du moteur à chaque tick : labels, secteurs, positions.",
      "doomlib sérialise l'état en texte plus une ligne de compas (distance et cap de la sortie).",
      "Le modèle MiniLM répond command, target et weapon en HTTP (/v1/systemone).",
      "L'exécuteur scripté (waypoints A*, approche des portes, latch d'ouverture 15 ticks) convertit la commande en 14 entrées de jeu.",
      "Aucun modèle de vision sur ce chemin ; une tête SFT 1.1M joue depuis les pixels en arène. Pas de RL.",
    ],
    mascotAlt: "Mascotte shiba inu qui branche une prise en forme de pièce de puzzle dans une prise murale",
  },

  bench: {
    h2: "Benchmarks, compromis compris",
    lede:
      "Sur le benchmark typed-decisions, Sabaki cède quelques points de score pour une latence environ 1000 fois plus basse, mesurée face au modèle Laya de 421M sur CPU.",
    chartTitle: "Score sur les jeux de test typed-decisions",
    chartAria: "Diagramme en barres des scores, de OpenDecider-nano à 0,796 jusqu’à Laya base à 0,362",
    peersTitle: "Modèles de décision ouverts plus gros (144-151M), pour référence",
    trackTitle: "Générations du généraliste (préliminaire)",
    trackCols: { gen: "Génération", mix: "Val mix", phish: "Rappel PhishNChips", td: "Test typed-decisions" },
    trackNote: "Chiffres préliminaires pendant l'entraînement v6 : la val mix est propre à chaque run (non comparable entre lignes) ; PhishNChips (2 000 emails tenus) et le test typed-decisions sont identiques pour toutes les lignes. *sous-échantillon n=200.",
    peersNote: "Le généraliste sabaki fait 22,7M : environ 6,5x plus petit que le plus petit modèle listé ici, et le plus petit modèle de décision généraliste de la liste. Chiffres auto-déclarés ; protocoles différents.",
    tags: {
      "OpenDecider-nano": "400M, GPU",
      "Laya typed-decisions": "421M, CPU environ 25 s",
      "TypeSafe Jev": "API uniquement",
      "sabaki mini": "22M int8, environ 20 ms",
      "sabaki nano": "TF-IDF, moins de 1 ms",
      "sabaki generalist": "22M, mix val (jeu interne, pas le test)",
      "Laya base": "421M, zero-shot",
    },
    latencyTitle: "Latence CPU par décision, échelle logarithmique",
    latencyAria: "Barres horizontales en échelle logarithmique : nano sous 1 ms, mini environ 20 ms, Laya environ 25 secondes",
    foot:
      "Les scores d’OpenDecider-nano, Laya et Jev sont des chiffres publiés, non remesurés. Les 25 s de Laya viennent du test CPU d’un portage ONNX par les auteurs de Sabaki. Le généraliste servi (mini, 22,7M) obtient 0,536 sur le jeu de test typed-decisions (v4 : 0,29) ; son 0,756 est sa propre validation mix — il reste hors du graphique en attendant les chiffres v1.",
    wfTitle: "Nano face à mini, par workflow",
    wfCols: { wf: "Workflow", q: "Question principale", nano: "nano", mini: "mini" },
    wfFoot: "Split temporel (lots de génération séparés) : 300 états d’entraînement et 100 de test par workflow. Sur les e-mails, nano obtient 0,865 sans aucun terme personnel, et MiniLM ne fait qu’égaler TF-IDF (à 0,02 près) : c’est donc nano qui est livré.",
  },

  compare: {
    h2: "Sabaki face aux autres approches",
    lede: "Face aux grands modèles de décisions typées, le compromis est quelques points de score contre un modèle qui tourne n’importe où.",
    cols: { what: "", sabaki: "Sabaki", big: "Grands modèles de décisions typées" },
    rows: [
      ["Taille du modèle", "Quelques Ko de poids (nano), 22M en int8 (mini)", "400M à 421M de paramètres (OpenDecider-nano, Laya)"],
      ["Où il tourne", "N’importe quel CPU, dans votre processus", "Un GPU, ou une API hébergée (Jev)"],
      ["Latence CPU", "Moins de 1 ms (nano), environ 20 ms (mini)", "Environ 25 s par état pour Laya"],
      ["Score au benchmark", "0,61 (nano), 0,69 (mini)", "0,754 à 0,796"],
      ["Coût par appel", "Aucun", "Temps GPU ou frais d’API"],
    ],
    llm:
      "Un LLM généraliste fait bien plus, et c’est lui qu’il faut utiliser pour du texte, du raisonnement ou des réponses ouvertes. Sabaki vise le cas étroit où il faut une étiquette en millisecondes, en local, avec une confiance sur laquelle fixer un seuil.",
    contrast: [
      { h: "Greffons", p: "Les experts de domaine sont des paquets séparés : vous n’installez que ceux vers lesquels vous routez." },
      { h: "Quantification ONNX int8", p: "Un modèle mini est livré à environ un quart de sa taille d’origine, pour 0,004 de précision." },
      { h: "Modèles nano", p: "Un classifieur de quelques kilooctets couvre les cas où un modèle plus gros n’apporte presque rien. Sur les e-mails, MiniLM égalait TF-IDF : nano est livré." },
    ],
  },

  quick: {
    h2: "Démarrage rapide",
    lede: "Commencez avec nano. Il est synchrone, embarqué et n’a besoin de rien d’autre.",
    tabsLabel: "Variantes de démarrage",
    tabs: [
      { id: "nano", label: "Nano" },
      { id: "mini", label: "Mini" },
      { id: "fallback", label: "Généraliste de repli" },
      { id: "http", label: "HTTP" },
      { id: "hosted", label: "API hébergée" },
    ],
    intro: {
      nano: "Enregistrez un greffon et appelez <code>decide</code>. Passez <code>question</code> pour poser une autre question que la principale.",
      mini: "Mini charge un modèle ONNX au premier usage et demande <code>onnxruntime-node</code>. Utilisez la voie asynchrone et un seuil de confiance.",
      fallback:
        "Le généraliste répond quand aucun spécialiste ne gagne le routage. Faites pointer <code>SABAKI_GENERALIST_DIR</code> vers un dossier contenant <code>generalist.onnx</code> et <code>tokenizer/tokenizer.json</code>. Il est encore en entraînement.",
      http: "Un serveur compatible Jev est fourni en exemple dans le dépôt. C’est un outil de développement : ajoutez une authentification avant de l’exposer.",
      hosted: "Pas envie de tout installer ? Pas de panique ! Nous hébergeons une instance gratuite, toujours à jour, ici même. Essayez avec le formulaire ci-dessous :",
    },
    hostedBtn: "Décider",
    hostedApi: "Ou appelez-la vous-même :",
    hostedOpts: "Options, séparées par des virgules :",
    hostedPh: "Un état à trancher…",
    hostedWait: "Décision en cours…",
    hostedErr: "API injoignable, réessayez plus tard.",
    copy: "Copier",
    copied: "Copié",
    result: "Résultat",
  },

  bunkitsu: {
    metaTitle: "Bunkitsu : des décisions batch sur CSV avec les greffons Sabaki",
    metaDesc:
      "Bunkitsu résout un fichier CSV ligne par ligne via les greffons Sabaki et réécrit décisions, confiance et probabilités en CSV. Ni GPU, ni clé d’API.",
    h1: "Des décisions batch sur CSV.",
    lede:
      "Bunkitsu envoie chaque ligne d’un CSV au routeur Sabaki — greffons nano, mini et cross-encoder, fallback selon la langue — et réécrit la décision. Des milliers de lignes, même moteur en millisecondes, traçabilité complète.",
    install: "npm i sabaki",
    cmd: "npx bunkitsu resolve entrees.csv --out resultats.csv --plugin ./mon-greffon",
    inH: "Colonnes d’entrée",
    inRows: [
      ["state", "le texte à décider"],
      ["question", "la question typée (ex. suspicious, jailbreak?)"],
      ["type", "choice, noul ou score"],
      ["options", "options séparées par | pour choice (vide pour noul)"],
    ],
    outH: "Colonnes de sortie",
    outRows: [
      ["state, question, type", "recopiées"],
      ["decision, confidence", "l’option gagnante et sa probabilité"],
      ["probs", "table option → probabilité complète (JSON)"],
      ["domain, model", "quel greffon et quel modèle ont répondu (traçabilité)"],
    ],
    exampleH: "Exemple",
    zhNote: "Les scripts non-latins sont routés vers le backend multilingue :",
    exampleNote: "Chaque ligne est routée indépendamment — le phishing vers le mini phishing, les jailbreaks vers le greffon jailbreak, le reste vers le généraliste dispatché par langue.",
    bandTitle: "Besoin de milliers de décisions, pas d’une seule ?",
    bandLede: "Bunkitsu résout des fichiers CSV entiers avec le même routeur et les mêmes greffons.",
    bandLink: "Voir comment Bunkitsu fonctionne",
    mascotAlt: "Shiba Inu tamponnant des feuilles CSV empilées",
  },

  paper: {
    h2: "Article scientifique",
    lede: "La conception, les mesures et les compromis derrière Sabaki, rédigés comme un article scientifique.",
    status: "Preprint v1 — octobre 2026",
    title: "Sabaki: An Organizational Mixture-of-Experts for Typed Decisions on CPU",
    authors: "Fox3000foxy, chercheur indépendant",
    body: "Les grands modèles de langage sont souvent sollicités pour des tâches qui relèvent de la classification. Sabaki remplace l’appel monolithique par un mélange d’experts organisationnel : un routeur sensible aux mots-clés et à la langue envoie chaque entrée vers un petit greffon classifieur indépendant (nano TF-IDF, moins de 1 ms ; mini MiniLM ONNX, environ 20 ms sur CPU ; ou un généraliste cross-encoder) qui renvoie une réponse typée avec confiance calibrée. Sur le split public typed-decisions, il obtient 0,61 (nano) et 0,69 (mini) contre 0,75 à 0,80 pour des modèles exigeant GPU ou API, pour une latence CPU en millisecondes au lieu d’allers-retours API (latences concurrentes jamais mesurées).",
    readPdf: "Lire le PDF (v1)",
    release: "Notes de version",
    source: "Sources LaTeX",
    cite: "Citer",
    bib: "@misc{sabaki2026orgmoe,\n  title  = {Sabaki: An Organizational Mixture-of-Experts for Typed Decisions on CPU},\n  author = {Fox3000foxy},\n  year   = {2026},\n  note   = {Preprint v1, octobre 2026},\n  url    = {https://sabaki.fox3000foxy.com/assets/paper/sabaki-organizational-moe-typed-decisions.pdf}\n}",
  },

  honest: {
    h2: "Ce qui n’est pas encore prêt",
    lede: "Le dépôt est franc sur ses lacunes, et cette page aussi.",
    items: [
      "Le généraliste en est à l’epoch 0 (score 0,56) et s’entraîne encore.",
      "Un mode base plus gros, pour les tâches difficiles, est en cours d’évaluation.",
      "Nano est le plus faible sur les traces d’agents (0,34 à 0,59). Mini porte <code>needs_review</code> à 0,82.",
      "Les états Doom en texte plafonnent vers 0,57 : seule la navigation avec mini termine le niveau.",
      "Les greffons du benchmark sont entraînés sur de l’anglais, et le greffon mail sur une boîte de réception en majorité française. Un entraînement multilingue est prévu en cas de demande.",
      "Le serveur HTTP est un outil de développement. Ajoutez une authentification avant de l’exposer.",
      "Prévu : le temperature scaling pour affiner la calibration, ainsi qu’un CLI et un hub de greffons (<code>bunkitsu</code>).",
    ],
    roadmap: "Lire la feuille de route complète",
  },

  faq: {
    h2: "Questions fréquentes",
    items: [
      {
        q: "Qu’est-ce que Sabaki ?",
        a: "Sabaki est une bibliothèque TypeScript qui route un texte vers le bon petit greffon classifieur et renvoie une réponse typée (un choix, un score ou un oui/non) avec une confiance calibrée. Elle tourne sur un CPU, en millisecondes.",
      },
      {
        q: "En quoi diffère-t-il d’un grand modèle de langage ?",
        a: "Il ne génère pas de texte. Il répond à des questions typées en une seule passe : vous obtenez une étiquette et une confiance en environ 1 ms (nano) ou 20 ms (mini), sans rien à analyser. Utilisez un LLM pour du texte ou du raisonnement, et Sabaki pour une décision.",
      },
      {
        q: "Faut-il un GPU ou une clé d’API ?",
        a: "Non. Nano n’a aucune dépendance d’exécution. Mini passe par le paquet optionnel onnxruntime-node sur un CPU ordinaire. Il n’y a aucun coût par appel.",
      },
      {
        q: "Quelle est sa précision ?",
        a: "Sur le benchmark typed-decisions, mini obtient 0,69 et nano 0,61, contre 0,754 à 0,796 pour des modèles qui exigent un GPU ou une API. La confiance est calibrée (ECE sous 0,16 pour mini) : vous pouvez automatiser au-dessus d’un seuil comme 0,8 et escalader le reste.",
      },
      {
        q: "Quelle différence entre nano, mini et le généraliste ?",
        a: "Nano est un classifieur TF-IDF et régression logistique de quelques kilooctets. Mini est un MiniLM affiné puis quantifié en ONNX int8, 22 Mo. Le généraliste est un cross-encoder qui répond à des questions définies à l’exécution, utilisé en repli quand aucun spécialiste ne correspond.",
      },
      {
        q: "Est-il compatible avec Jev et System One ?",
        a: "Sabaki parle un sous-ensemble compatible Jev du contrat System One en HTTP : POST /v1/systemone, GET /health et GET /v1/models. Le champ model nomme le modèle qui a réellement répondu.",
      },
      {
        q: "Puis-je écrire mon propre greffon ?",
        a: "Oui. Un greffon est un manifeste et une fonction classify. Utilisez definePlugin pour n’importe quelle logique, nanoClassifier pour des poids TF-IDF, miniClassifier pour un modèle ONNX, ou partez du modèle de greffon.",
      },
      {
        q: "Quelles langues sont prises en charge ?",
        a: "Les quatre greffons du benchmark sont entraînés sur de l’anglais et le greffon mail sur une boîte de réception en majorité française. L’entraînement multilingue figure sur la feuille de route, en cas de demande.",
      },
      {
        q: "Quelle est la licence ?",
        a: "MIT. Les paquets sont publiés sur npm avec provenance via la publication de confiance, et tout s’exécute en local : vos textes restent chez vous.",
      },
    ],
  },

  footer: {
    project: "Projet",
    resources: "Ressources",
    items: {
      github: "Organisation GitHub",
      repo: "sabaki sur GitHub",
      npm: "sabaki sur npm",
      guide: "Guide",
      roadmap: "Feuille de route",
      models: "Poids des modèles",
      template: "Modèle de greffon",
      systemOne: "Documentation System One",
      paper: "Article scientifique (PDF v1)",
    },
    license: "Publié sous licence MIT.",
    top: "Haut de page",
    legal: "Mentions légales",
    legalTitle: "Mentions légales",
    legalBody: "Éditeur : sabaki-js. Hébergement : Cloudflare, Inc. Ce site ne collecte aucune donnée personnelle : ni comptes, ni cookies, ni mesure d'audience, ni scripts tiers.",
    close: "Fermer",
  },
};

// ---- French typography: non-breaking spaces before : ; ! ? and inside « » ----
const nbsp = " ";
const nnbsp = " ";
function frTypo(s) {
  return s
    .replace(/ :/g, `${nbsp}:`)
    .replace(/ ([;!?])/g, `${nnbsp}$1`)
    .replace(/« /g, `«${nbsp}`)
    .replace(/ »/g, `${nbsp}»`);
}
function deepMap(v, fn) {
  if (typeof v === "string") return fn(v);
  if (typeof v === "function") return (...a) => fn(v(...a));
  if (Array.isArray(v)) return v.map((x) => deepMap(x, fn));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepMap(x, fn)]));
  return v;
}
const frTyped = deepMap(fr, frTypo);
// Keep the same-language fields that must not be altered.
frTyped.lang = "fr";
frTyped.locale = "fr_FR";
frTyped.htmlLang = "fr";

export const T = { en, fr: frTyped };
