/**
 * Chargement de plugins Sabaki compiles en WebAssembly (prototype, ABI v1).
 *
 * Deux niveaux de verification :
 *  1. statique, avant instanciation : magic WASM, section custom `sabaki`
 *     (`SABK` + version de spec + version d'ABI), exports requis ;
 *  2. dynamique : manifest conforme, puis sortie de `classify` conforme
 *     (decision dans les options, confiance dans [0,1], probabilites somme ~1).
 */
import type {
	ClassifyOutput,
	PluginManifest,
	SabakiInput,
	SabakiPlugin,
} from "./index.js";

export const WASM_SPEC_ID = "sabaki-plugin/1";
export const WASM_SPEC_VERSION = 1;
export const WASM_ABI_VERSION = 1;

const REQUIRED_EXPORTS = [
	"sabaki_abi",
	"sabaki_manifest",
	"sabaki_input",
	"sabaki_input_capacity",
	"sabaki_classify",
] as const;

export class WasmSpecError extends Error {
	constructor(
		message: string,
		readonly code:
			| "wasm-magic"
			| "wasm-version"
			| "spec-section"
			| "spec-version"
			| "abi-version"
			| "exports"
			| "manifest"
			| "input"
			| "output",
	) {
		super(`plugin wasm invalide (${code}) : ${message}`);
		this.name = "WasmSpecError";
	}
}

export interface WasmSpec {
	/** Version de la specification Sabaki declaree dans la section custom. */
	version: number;
	/** Version d'ABI declaree dans la section custom. */
	abi: number;
}

function readVarUint32(
	bytes: Uint8Array,
	offset: number,
): { value: number; next: number } {
	let value = 0;
	let shift = 0;
	let pos = offset;
	for (;;) {
		if (pos >= bytes.length) throw new WasmSpecError("section tronquee", "spec-section");
		const b = bytes[pos++]!;
		value |= (b & 0x7f) << shift;
		if ((b & 0x80) === 0) return { value: value >>> 0, next: pos };
		shift += 7;
		if (shift > 35) throw new WasmSpecError("LEB128 trop long", "spec-section");
	}
}

function readName(bytes: Uint8Array, offset: number): { name: string; next: number } {
	const { value: len, next } = readVarUint32(bytes, offset);
	if (next + len > bytes.length) {
		throw new WasmSpecError("nom de section tronque", "spec-section");
	}
	const name = new TextDecoder().decode(bytes.subarray(next, next + len));
	return { name, next: next + len };
}

/**
 * Valide le marqueur et l'ABI d'un module, sans l'instancier.
 */
export function readWasmSpec(bytes: Uint8Array): WasmSpec {
	if (
		bytes.length < 8 ||
		bytes[0] !== 0x00 ||
		bytes[1] !== 0x61 ||
		bytes[2] !== 0x73 ||
		bytes[3] !== 0x6d
	) {
		throw new WasmSpecError("ce n'est pas un module wasm", "wasm-magic");
	}
	if (bytes[4] !== 0x01 || bytes[5] !== 0x00 || bytes[6] !== 0x00 || bytes[7] !== 0x00) {
		throw new WasmSpecError("version wasm non supportee", "wasm-version");
	}

	let pos = 8;
	while (pos < bytes.length) {
		const id = bytes[pos++]!;
		const { value: size, next } = readVarUint32(bytes, pos);
		pos = next;
		if (pos + size > bytes.length) {
			throw new WasmSpecError("section tronquee", "spec-section");
		}
		if (id === 0) {
			const { name, next: dataStart } = readName(bytes, pos);
			if (name === "sabaki") {
				const data = bytes.subarray(dataStart, pos + size);
				if (data.length < 8 || String.fromCharCode(...data.subarray(0, 4)) !== "SABK") {
					throw new WasmSpecError("marqueur SABK absent", "spec-section");
				}
				const version = data[4]! | (data[5]! << 8);
				const abi = data[6]! | (data[7]! << 8);
				if (version !== WASM_SPEC_VERSION) {
					throw new WasmSpecError(
						`spec v${version}, attendu v${WASM_SPEC_VERSION}`,
						"spec-version",
					);
				}
				if (abi !== WASM_ABI_VERSION) {
					throw new WasmSpecError(
						`ABI v${abi}, attendu v${WASM_ABI_VERSION}`,
						"abi-version",
					);
				}
				return { version, abi };
			}
		}
		pos += size;
	}
	throw new WasmSpecError("section custom `sabaki` absente", "spec-section");
}

function validateManifest(raw: unknown, options: string[]): PluginManifest {
	const m = raw as Record<string, unknown>;
	const fail = (msg: string): never => {
		throw new WasmSpecError(msg, "manifest");
	};
	if (m?.spec !== WASM_SPEC_ID) fail(`spec attendue "${WASM_SPEC_ID}"`);
	if (typeof m.name !== "string" || m.name.length === 0) fail("name requis");
	if (typeof m.domain !== "string" || m.domain.length === 0) fail("domain requis");
	if (typeof m.version !== "string" || m.version.length === 0) fail("version requise");
	const questions = Array.isArray(m.questions) ? (m.questions as unknown[]) : [];
	if (questions.length === 0) fail("questions requises");
	if (!questions.every((q) => typeof q === "string")) fail("questions doivent etre des chaines");
	if (!Array.isArray(m.keywords)) fail("keywords requis");
	if (m.primary !== undefined && !questions.includes(m.primary)) {
		fail("primary doit appartenir a questions");
	}
	if (options.length === 0) fail("options requises pour valider la decision");
	return {
		name: m.name,
		domain: m.domain,
		version: m.version,
		questions: m.questions as string[],
		primary: m.primary as string | undefined,
		keywords: m.keywords as string[],
		languages: m.languages as string[] | undefined,
		threshold: m.threshold as number | undefined,
	} as PluginManifest;
}

function validateOutput(raw: unknown, options: string[], domain: string): ClassifyOutput {
	const o = raw as Record<string, unknown>;
	if (typeof o?.decision !== "string") {
		throw new WasmSpecError("decision manquante", "output");
	}
	if (!options.includes(o.decision)) {
		throw new WasmSpecError(`decision "${o.decision}" hors options`, "output");
	}
	if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1) {
		throw new WasmSpecError("confidence hors [0,1]", "output");
	}
	if (typeof o.domain !== "string" || o.domain !== domain) {
		throw new WasmSpecError(`domain "${String(o.domain)}" != manifest "${domain}"`, "output");
	}
	if (o.probabilities !== undefined) {
		if (typeof o.probabilities !== "object" || o.probabilities === null) {
			throw new WasmSpecError("probabilities doit etre un objet", "output");
		}
		let sum = 0;
		for (const [k, v] of Object.entries(o.probabilities)) {
			if (!options.includes(k)) throw new WasmSpecError(`probabilite pour "${k}" hors options`, "output");
			if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
				throw new WasmSpecError("probabilite hors [0,1]", "output");
			}
			sum += v;
		}
		if (Math.abs(sum - 1) > 0.02) {
			throw new WasmSpecError(`probabilites de somme ${sum.toFixed(4)}`, "output");
		}
	}
	return {
		decision: o.decision,
		confidence: o.confidence,
		domain: o.domain,
		probabilities: o.probabilities as Record<string, number> | undefined,
	};
}

function encodeInput(state: string, question: string, options: string[]): Uint8Array {
	const enc = new TextEncoder();
	const parts: Uint8Array[] = [];
	const u32 = (n: number) => {
		const b = new Uint8Array(4);
		new DataView(b.buffer).setUint32(0, n, true);
		parts.push(b);
	};
	const str = (s: string) => {
		const b = enc.encode(s);
		u32(b.length);
		parts.push(b);
	};
	str(state);
	str(question);
	u32(options.length);
	for (const o of options) str(o);
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const p of parts) {
		out.set(p, off);
		off += p.length;
	}
	return out;
}

function readLengthPrefixed(memory: WebAssembly.Memory, ptr: number): string {
	const view = new DataView(memory.buffer);
	const len = view.getUint32(ptr, true);
	if (len > memory.buffer.byteLength - ptr - 4) {
		throw new WasmSpecError("sortie tronquee", "output");
	}
	return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr + 4, len));
}

/**
 * Instancie un plugin wasm apres validation de la spec et du manifest.
 */
export async function loadWasmPlugin(
	bytes: Uint8Array | ArrayBuffer,
): Promise<SabakiPlugin> {
	const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	readWasmSpec(buf);

	const { instance } = await WebAssembly.instantiate(buf, {
		env: {
			abort: () => {
				throw new WasmSpecError("abort dans le module", "exports");
			},
		},
	});
	const exports = instance.exports as unknown as Record<string, unknown>;
	for (const name of REQUIRED_EXPORTS) {
		if (typeof exports[name] !== "function") {
			throw new WasmSpecError(`export "${name}" manquant`, "exports");
		}
	}

	const memory = exports.memory as WebAssembly.Memory;
	if (!(memory instanceof WebAssembly.Memory)) {
		throw new WasmSpecError("export memory manquant", "exports");
	}
	const abi = (exports.sabaki_abi as () => number)();
	if (abi !== WASM_ABI_VERSION) {
		throw new WasmSpecError(`ABI runtime v${abi}`, "abi-version");
	}

	const manifestPtr = (exports.sabaki_manifest as () => number)();
	const manifestRaw = JSON.parse(readLengthPrefixed(memory, manifestPtr)) as Record<string, unknown>;
	const manifestOptions = Array.isArray(manifestRaw.options)
		? (manifestRaw.options as unknown[]).filter((o): o is string => typeof o === "string")
		: [];
	const manifest = validateManifest(manifestRaw, manifestOptions);

	const inputPtr = (exports.sabaki_input as () => number)();
	const capacity = (exports.sabaki_input_capacity as () => number)();
	const classify = exports.sabaki_classify as (len: number) => number;

	return {
		manifest,
		classify: (input: SabakiInput): ClassifyOutput => {
			const options = Array.isArray(input.options)
				? (input.options as unknown[]).filter((o): o is string => typeof o === "string")
				: manifestOptions;
			if (options.length === 0) {
				throw new WasmSpecError("aucune option pour classify", "input");
			}
			const question = input.question && input.question.length > 0
				? input.question
				: (manifest.primary ?? manifest.questions[0]!);
			const payload = encodeInput(input.state, question, options);
			if (payload.length > capacity) {
				throw new WasmSpecError(
					`entree ${payload.length} > capacite ${capacity}`,
					"input",
				);
			}
			new Uint8Array(memory.buffer, inputPtr, payload.length).set(payload);
			const outPtr = classify(payload.length);
			const parsed = JSON.parse(readLengthPrefixed(memory, outPtr)) as unknown;
			return validateOutput(parsed, options, manifest.domain);
		},
	};
}
