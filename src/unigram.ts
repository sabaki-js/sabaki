/**
 * Minimal SentencePiece-Unigram encoder (Hugging Face `tokenizer.json`,
 * `model.type === "Unigram"`). Viterbi best-path parity with `transformers`.
 *
 * Covers XLM-R / paraphrase-multilingual style models that the WordPiece
 * runtime (`wordpiece.ts`) cannot read. Unknown chars -> `unkId`
 * (this model's exports carry no `<0x..>` byte-fallback pieces).
 */
export interface UnigramVocab {
	/** piece -> id (index in the vocab list). */
	idByPiece: Map<string, number>;
	/** id -> unigram score (Viterbi weights). */
	scoreById: number[];
	unkId: number;
	bosId: number;
	eosId: number;
	padId: number;
	maxPiece: number;
}

/** Loads a Unigram vocabulary from a parsed `tokenizer.json`. */
export function loadUnigram(tokenizerJson: unknown): UnigramVocab {
	const t = tokenizerJson as {
		model: { vocab: Array<[string, number]>; unk_id: number };
	};
	const idByPiece = new Map<string, number>();
	const scoreById: number[] = [];
	let maxPiece = 0;
	t.model.vocab.forEach(([piece, score], id) => {
		if (!idByPiece.has(piece)) {
			idByPiece.set(piece, id);
			maxPiece = Math.max(maxPiece, piece.length);
		}
		scoreById[id] = score;
	});
	const bosId = idByPiece.get("<s>") ?? 0;
	const eosId = idByPiece.get("</s>") ?? 2;
	return {
		idByPiece,
		scoreById,
		unkId: t.model.unk_id ?? 3,
		bosId,
		eosId,
		padId: idByPiece.get("<pad>") ?? 1,
		maxPiece,
	};
}

function normalize(s: string): string {
	// Parity with the model's Precompiled normalizer (NFKC, case KEPT:
	// `▁Which` outscores `▁which`, i.e. no lowercasing despite the config
	// flag; `strip_accents` is null so accents are kept too).
	return s.normalize("NFKC");
}

function viterbi(chunk: string, v: UnigramVocab): number[] {
	// chunk already carries its leading "▁".
	const n = chunk.length;
	const best = new Array(n + 1).fill(-Infinity);
	const prev = new Array(n + 1).fill(-1);
	const pid = new Array(n + 1).fill(-1);
	best[0] = 0;
	for (let i = 0; i < n; i++) {
		if (best[i] === -Infinity) continue;
		let matched = false;
		const end = Math.min(n, i + v.maxPiece);
		for (let j = i + 1; j <= end; j++) {
			const id = v.idByPiece.get(chunk.slice(i, j));
			if (id !== undefined) {
				matched = true;
				const s = best[i]! + (v.scoreById[id] ?? 0);
				if (s > best[j]!) {
					best[j] = s;
					prev[j] = i;
					pid[j] = id;
				}
			}
		}
		if (!matched) {
			// Unknown char -> unk, advance one code point.
			const cp = chunk.codePointAt(i)!;
			const j = i + (cp > 0xffff ? 2 : 1);
			const s = best[i]! + (v.scoreById[v.unkId] ?? -1e9);
			if (s > best[j]!) {
				best[j] = s;
				prev[j] = i;
				pid[j] = v.unkId;
			}
		}
	}
	const ids: number[] = [];
	let j = n;
	while (j > 0 && prev[j] !== -1) {
		ids.unshift(pid[j]!);
		j = prev[j]!;
	}
	return ids;
}

/**
 * Encodes text into IDs + mask (`<s>` ... `</s>`, truncated to `maxLen`).
 * `"[SEP]"` markers are plain text (as in training: the Unigram tokenizer
 * has no `[SEP]` special token, `AutoTokenizer` segments it literally).
 */
export function encodeUnigram(
	text: string,
	v: UnigramVocab,
	maxLen = 256,
): { ids: number[]; mask: number[] } {
	const ids: number[] = [v.bosId];
	for (const word of normalize(text).split(/\s+/).filter(Boolean)) {
		ids.push(...viterbi(`\u2581${word}`, v));
	}
	const out = ids.slice(0, maxLen - 1);
	out.push(v.eosId);
	return { ids: out, mask: new Array(out.length).fill(1) };
}
