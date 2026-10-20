/**
 * Prototype de plugin Sabaki compile en WebAssembly (AssemblyScript).
 *
 * ABI v1 (buffers statiques, pas d'allocateur expose) :
 *   sabaki_abi() -> i32                 version d'ABI (1)
 *   sabaki_manifest() -> i32            pointeur [u32 len][utf8 json]
 *   sabaki_input() -> i32               pointeur du buffer d'entree
 *   sabaki_input_capacity() -> i32      capacite du buffer d'entree
 *   sabaki_classify(len: i32) -> i32    lit l'entree, ecrit [u32 len][utf8 json]
 *
 * Entree (little-endian) :
 *   u32 stateLen,  state utf8
 *   u32 qLen,      question utf8
 *   u32 nOptions,  nOptions x (u32 len, option utf8)
 */

const CAP: i32 = 65536;
const inBuf = new ArrayBuffer(CAP);
const inPtr = changetype<usize>(inBuf);
const outBuf = new ArrayBuffer(CAP);
const outPtr = changetype<usize>(outBuf);

const MANIFEST: string =
	'{"spec":"sabaki-plugin/1",' +
	'"name":"@sabaki-js/proto-wasm",' +
	'"domain":"proto",' +
	'"version":"0.1.0",' +
	'"questions":["intent"],' +
	'"primary":"intent",' +
	'"keywords":["colis","facture","bug"],' +
	'"options":["shipping","billing","technical"]}';

function putOut(s: string): i32 {
	const b = Uint8Array.wrap(String.UTF8.encode(s, false));
	const n = b.length;
	store<u32>(outPtr, n);
	for (let i = 0; i < n; i++) store<u8>(outPtr + 4 + i, b[i]);
	return <i32>outPtr;
}

function readStr(p: usize, len: i32): string {
	return String.UTF8.decodeUnsafe(p, len);
}

function keywordsFor(option: string): string[] {
	if (option == "shipping") {
		return ["package", "parcel", "shipping", "delivery", "tracking", "colis", "livraison", "arrived"];
	}
	if (option == "billing") {
		return ["bill", "invoice", "charged", "refund", "payment", "facture", "paiement", "remboursement"];
	}
	if (option == "technical") {
		return ["crash", "bug", "error", "login", "password", "app", "erreur", "plante"];
	}
	return [];
}

export function sabaki_abi(): i32 {
	return 1;
}

export function sabaki_input(): i32 {
	return <i32>inPtr;
}

export function sabaki_input_capacity(): i32 {
	return CAP;
}

export function sabaki_manifest(): i32 {
	return putOut(MANIFEST);
}

export function sabaki_classify(len: i32): i32 {
	const end = inPtr + <usize>len;
	let p = inPtr;

	const stateLen = <i32>load<u32>(p);
	p += 4;
	const state = readStr(p, stateLen);
	p += <usize>stateLen;

	const qLen = <i32>load<u32>(p);
	p += 4;
	const question = readStr(p, qLen);
	p += <usize>qLen;

	const n = <i32>load<u32>(p);
	p += 4;
	const options: string[] = [];
	for (let i = 0; i < n; i++) {
		const l = <i32>load<u32>(p);
		p += 4;
		options.push(readStr(p, l));
		p += <usize>l;
	}

	if (p > end) {
		return putOut('{"error":"input truncated"}');
	}
	if (options.length == 0) {
		return putOut('{"error":"no options"}');
	}

	const text = state.toLowerCase();
	const scores: f64[] = [];
	let maxScore: f64 = 0;
	for (let i = 0; i < options.length; i++) {
		const kws = keywordsFor(options[i]);
		let hits = 0;
		for (let k = 0; k < kws.length; k++) {
			if (text.indexOf(kws[k]) >= 0) hits++;
		}
		const s = <f64>hits;
		scores.push(s);
		if (s > maxScore) maxScore = s;
	}

	let sum: f64 = 0;
	const probs: f64[] = [];
	for (let i = 0; i < scores.length; i++) {
		const e = Math.exp(scores[i] - maxScore);
		probs.push(e);
		sum += e;
	}

	let best = 0;
	let bestP: f64 = -1;
	for (let i = 0; i < options.length; i++) {
		const p2 = probs[i] / sum;
		if (p2 > bestP) {
			bestP = p2;
			best = i;
		}
	}

	let head = '{"decision":"' + options[best] + '","confidence":' + bestP.toString() +
		',"domain":"proto","question":"' + question + '","probabilities":{';
	let body = "";
	for (let i = 0; i < options.length; i++) {
		if (i > 0) body += ",";
		body += '"' + options[i] + '":' + (probs[i] / sum).toString();
	}
	return putOut(head + body + "}}");
}
