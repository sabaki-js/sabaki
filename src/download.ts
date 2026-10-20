/**
 * Downloads `mini` weights from the `sabaki-models` Releases
 * (no authentication), with SHA256 verification and local cache
 * (`~/.cache/sabaki/<version>/<workflow>-<variant>/`). Valid files are never
 * re-downloaded; a corrupted file is deleted and reported.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

const CACHE = path.join(os.homedir(), ".cache", "sabaki");

/** Hardcoded fallbacks when `versions.json` is unreachable. */
const FALLBACK_VERSIONS: Record<string, string> = {
	minilaya: "v0.2.0",
	generalist: "v1.0.0",
	"generalist-multi": "v1.1.0-multi-beta",
	biencoder: "biencoder-v1.0.0",
	mail: "v0.5.0",
	doom: "v0.3.0",
};

/**
 * Resolves `"latest"` (or undefined) to a release tag via the versioned
 * `versions.json` pointer (24h cache), else the hardcoded fallback.
 */
export async function resolveVersion(family: string, version?: string): Promise<string> {
	if (version && version !== "latest") return version;
	const cached = path.join(CACHE, "versions.json");
	const fresh = fs.existsSync(cached) && Date.now() - fs.statSync(cached).mtimeMs < 24 * 3600e3;
	try {
		if (!fresh) {
			await fetchFile(
				"https://raw.githubusercontent.com/sabaki-js/sabaki-models/master/versions.json",
				cached,
			);
		}
		const map = JSON.parse(fs.readFileSync(cached, "utf8")) as Record<string, string>;
		if (map[family]) return map[family]!;
	} catch {
		/* repli ci-dessous */
	}
	return FALLBACK_VERSIONS[family] ?? "v0.2.0";
}

function sha256(file: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const h = crypto.createHash("sha256");
		fs.createReadStream(file)
			.on("data", (d) => h.update(d))
			.on("end", () => resolve(h.digest("hex")))
			.on("error", reject);
	});
}

async function fetchFile(url: string, dest: string): Promise<void> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) throw new Error(`download ${url}: ${res.status}`);
	fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/**
 * Prepares a workflow's `mini` model directory, ready for {@link loadMini}.
 *
 * @param {string} workflow - The workflow (e.g. `"customer_service"`).
 * @param {string} version - The release tag (default `"v0.2.0"`).
 * @param {"int8" | "fp32"} variant - Quantized (default, ~22 MB) or full precision (~90 MB).
 * @returns {Promise<string>} The directory path (`model.json` + ONNX + tokenizer).
 * @throws {Error} On network failure or invalid SHA256.
 * @example
 * ```ts
 * const dir = await ensureMiniModel("customer_service");
 * const mini = await loadMini(dir);
 * ```
 */
/**
 * Prepares the `generalist` cross-encoder dir (`generalist.onnx` +
 * `tokenizer.json`), ready for {@link loadGeneralist}.
 *
 * @param {string} version - The release tag (default `"v0.4.0"`).
 * @returns {Promise<string>} The directory path.
 * @throws {Error} On network failure or invalid SHA256.
 * @example
 * ```ts
 * const dir = await ensureGeneralist();
 * const backend = loadGeneralist(dir);
 * ```
 */
export async function ensureGeneralist(version?: string, family = "generalist"): Promise<string> {
	version = await resolveVersion(family, version);
	const releaseBase = `https://github.com/sabaki-js/sabaki-models/releases/download/${version}`;
	const sub = family === "generalist" ? "generalist" : family;
	const dir = path.join(CACHE, version, sub);
	fs.mkdirSync(dir, { recursive: true });
	const sums: Record<string, string> = {};
	const sumsCached = path.join(CACHE, version, "SHA256SUMS_GENERALIST");
	if (!fs.existsSync(sumsCached)) {
		await fetchFile(`${releaseBase}/SHA256SUMS_GENERALIST`, sumsCached);
	}
	for (const line of fs.readFileSync(sumsCached, "utf8").split("\n")) {
		const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
		if (m) sums[m[2]!] = m[1]!;
	}
	for (const f of ["generalist.onnx", "tokenizer.json", "config.json"]) {
		const dest = path.join(dir, f);
		const sum = sums[f];
		const ok = fs.existsSync(dest) && sum && (await sha256(dest)) === sum;
		if (!ok) {
			await fetchFile(`${releaseBase}/${encodeURIComponent(f)}`, dest);
			if (sum && (await sha256(dest)) !== sum) {
				fs.unlinkSync(dest);
				throw new Error(`Invalid SHA256 for ${f}`);
			}
		}
	}
	fs.mkdirSync(path.join(dir, "tokenizer"), { recursive: true });
	const tokDest = path.join(dir, "tokenizer", "tokenizer.json");
	if (!fs.existsSync(tokDest)) {
		fs.copyFileSync(path.join(dir, "tokenizer.json"), tokDest);
	}
	return dir;
}
/**
 * Prépare le bi-encodeur multilingue (`biencoder_<variant>.onnx` +
 * `tokenizer/tokenizer.json`), prêt pour {@link loadBiencoder}.
 *
 * Un seul candidat par question : la décision est un seuil, donc l'int8
 * (119 Mo, mesuré sans perte de qualité) est le défaut ; le fp32 (471 Mo)
 * reste disponible pour comparer.
 *
 * @param {"int8" | "fp32"} variant - Quantifié (défaut) ou pleine précision.
 * @param {string} version - Tag de release (défaut `"biencoder-v1.0.0"`).
 * @returns {Promise<string>} Le répertoire (`biencoder_*.onnx` + `tokenizer/`).
 * @throws {Error} Sur échec réseau ou SHA256 invalide.
 * @example
 * ```ts
 * const dir = await ensureBiencoder();
 * const sem = await loadBiencoder(dir, "biencoder_int8.onnx");
 * ```
 */
export async function ensureBiencoder(
	variant: "int8" | "fp32" = "int8",
	version?: string,
): Promise<string> {
	version = await resolveVersion("biencoder", version);
	const releaseBase = `https://github.com/sabaki-js/sabaki-models/releases/download/${version}`;
	const dir = path.join(CACHE, version, `biencoder-${variant}`);
	fs.mkdirSync(path.join(dir, "tokenizer"), { recursive: true });
	const sums: Record<string, string> = {};
	const sumsCached = path.join(CACHE, version, "SHA256SUMS_BIENCODER");
	if (!fs.existsSync(sumsCached)) {
		await fetchFile(`${releaseBase}/SHA256SUMS_BIENCODER`, sumsCached);
	}
	for (const line of fs.readFileSync(sumsCached, "utf8").split("\n")) {
		const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
		if (m) sums[m[2]!] = m[1]!;
	}
	const model = `biencoder_${variant}.onnx`;
	const files: Array<[string, string]> = [
		[model, path.join(dir, model)],
		["tokenizer.json", path.join(dir, "tokenizer", "tokenizer.json")],
	];
	for (const [asset, dest] of files) {
		const sum = sums[asset];
		const ok = fs.existsSync(dest) && sum && (await sha256(dest)) === sum;
		if (!ok) {
			await fetchFile(`${releaseBase}/${asset}`, dest);
			if (sum && (await sha256(dest)) !== sum) {
				fs.unlinkSync(dest);
				throw new Error(`Invalid SHA256 for ${asset}`);
			}
		}
	}
	return dir;
}

export async function ensureMiniModel(
	workflow: string,
	version?: string,
	variant: "int8" | "fp32" = "int8",
): Promise<string> {
	const family = workflow === "mail" ? "mail" : workflow === "doom" ? "doom" : "minilaya";
	version = await resolveVersion(family, version);
	const releaseBase = `https://github.com/sabaki-js/sabaki-models/releases/download/${version}`;
	const suffix = variant === "int8" ? "_int8" : "";
	const dir = path.join(CACHE, version, `${workflow}-${variant}`);
	fs.mkdirSync(dir, { recursive: true });
	const sums: Record<string, string> = {};
	const sumsName = variant === "int8" ? "SHA256SUMS_INT8" : "SHA256SUMS";
	const sumsCached = path.join(CACHE, version, sumsName);
	if (!fs.existsSync(sumsCached)) {
		try {
			await fetchFile(`${releaseBase}/${sumsName}`, sumsCached);
		} catch {
			// Fallback : releases sans fichier _INT8 (ex v0.1.0) - seul SHA256SUMS.
			const fallback = path.join(CACHE, version, "SHA256SUMS");
			if (sumsCached !== fallback) {
				if (!fs.existsSync(fallback)) {
					await fetchFile(`${releaseBase}/SHA256SUMS`, fallback);
				}
				fs.copyFileSync(fallback, sumsCached);
			} else {
				throw new Error(`download ${releaseBase}/${sumsName} failed`);
			}
		}
	}
	for (const line of fs.readFileSync(sumsCached, "utf8").split("\n")) {
		const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
		if (m) sums[m[2]!] = m[1]!;
	}
	const files = [
		`minilaya-onnx/${workflow}${suffix}.onnx`,
		`minilaya-onnx/${workflow}${suffix}.onnx.data`,
	];
	const metaBase = `https://github.com/sabaki-js/sabaki-models/releases/download/v0.1.0`;
	const meta = [
		`minilaya-onnx/${workflow}.json`,
		"minilaya-onnx/tokenizer/tokenizer.json",
	];
	for (const f of files) {
		const base = path.basename(f);
		const dest = path.join(dir, base);
		const sum = sums[f] ?? sums[base];
		const ok = fs.existsSync(dest) && sum && (await sha256(dest)) === sum;
		if (!ok) {
			try {
				await fetchFile(`${releaseBase}/${encodeURIComponent(base)}`, dest);
			} catch {
				// Modèles mono-fichier (pas de .onnx.data externe) : optionnel.
				if (f.endsWith(".onnx.data")) continue;
				throw new Error(`download ${releaseBase}/${base} failed`);
			}
			if (sum && (await sha256(dest)) !== sum) {
				fs.unlinkSync(dest);
				throw new Error(`Invalid SHA256 for ${f}`);
			}
		}
	}
	for (const f of meta) {
		const base = path.basename(f);
		const dest = path.join(dir, base);
		const sum = sums[f] ?? sums[base];
		const ok =
			fs.existsSync(dest) && (!sum || (await sha256(dest)) === sum);
		if (!ok) {
			await fetchFile(`${metaBase}/${encodeURIComponent(base)}`, dest);
			if (sum && (await sha256(dest)) !== sum) {
				fs.unlinkSync(dest);
				throw new Error(`Invalid SHA256 for ${f}`);
			}
		}
	}
	const tempFile = path.join(dir, "temperatures.json");
	if (!fs.existsSync(tempFile)) {
		try {
			await fetchFile(`${releaseBase}/temperatures.json`, tempFile);
		} catch {
			/* températures optionnelles */
		}
	}
	let temperatures: Record<string, Record<string, number>> = {};
	try {
		temperatures = JSON.parse(fs.readFileSync(path.join(dir, "temperatures.json"), "utf8"));
	} catch {
		/* pas de températures : confiance brute */
	}
	const cfg = JSON.parse(fs.readFileSync(path.join(dir, `${workflow}.json`), "utf8"));
	if (temperatures[workflow]) {
		const tw = temperatures[workflow] as Record<string, { T: number } | number>;
		cfg.temperatures = Object.fromEntries(
			Object.entries(tw).map(([q, v]) => [q, typeof v === "number" ? v : v.T]),
		);
	}
	fs.writeFileSync(
		path.join(dir, "model.json"),
		JSON.stringify({ model: `${workflow}${suffix}.onnx`, config: cfg }),
	);
	return dir;
}
