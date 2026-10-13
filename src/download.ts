/**
 * Downloads `mini` weights from the `sabaki-models` Releases
 * (no authentication), with SHA256 verification and local cache
 * (`~/.cache/sabaki/<version>/<workflow>/`). Valid files are never
 * re-downloaded; a corrupted file is deleted and reported.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

const RELEASE =
	"https://github.com/sabaki-js/sabaki-models/releases/download/v0.1.0";
const CACHE = path.join(os.homedir(), ".cache", "sabaki");

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
export async function ensureMiniModel(
	workflow: string,
	version = "v0.2.0",
	variant: "int8" | "fp32" = "int8",
): Promise<string> {
	const releaseBase = `https://github.com/sabaki-js/sabaki-models/releases/download/${version}`;
	const suffix = variant === "int8" ? "_int8" : "";
	const dir = path.join(CACHE, version, `${workflow}-${variant}`);
	fs.mkdirSync(dir, { recursive: true });
	const sums: Record<string, string> = {};
	const sumsName = variant === "int8" ? "SHA256SUMS_INT8" : "SHA256SUMS";
	const sumsCached = path.join(CACHE, version, sumsName);
	if (!fs.existsSync(sumsCached)) {
		await fetchFile(`${releaseBase}/${sumsName}`, sumsCached);
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
			await fetchFile(`${releaseBase}/${encodeURIComponent(base)}`, dest);
			if (sum && (await sha256(dest)) !== sum) {
				fs.unlinkSync(dest);
				throw new Error(`Invalid SHA256 for ${f}`);
			}
		}
	}
	for (const f of meta) {
		const base = path.basename(f);
		const dest = path.join(dir, base);
		if (!fs.existsSync(dest) || (await sha256(dest)) === "") {
			await fetchFile(`${metaBase}/${encodeURIComponent(base)}`, dest);
		}
	}
	fs.writeFileSync(
		path.join(dir, "model.json"),
		JSON.stringify({
			model: `${workflow}${suffix}.onnx`,
			config: JSON.parse(
				fs.readFileSync(path.join(dir, `${workflow}.json`), "utf8"),
			),
		}),
	);
	return dir;
}
