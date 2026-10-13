/**
 * WordPiece minimal pour les modèles `mini` (vocabulaire `tokenizer.json`
 * Hugging Face, modèles uncased type MiniLM). Parité d'IDs exacte avec
 * `transformers` : normalisation NFD + minuscules, ponctuation isolée,
 * plus-long-match glouton, `[CLS]`/`[SEP]`.
 */
export interface MiniVocab {
	vocab: Map<string, number>;
	unk: string;
}

/**
 * Charge un vocabulaire depuis un `tokenizer.json` Hugging Face.
 *
 * @param {unknown} tokenizerJson - Le contenu parsé de `tokenizer.json`.
 * @returns {MiniVocab} Le vocabulaire indexé.
 */
export function loadVocab(tokenizerJson: unknown): MiniVocab {
	const t = tokenizerJson as {
		model: { vocab: Record<string, number>; unk_token: string };
	};
	return {
		vocab: new Map(Object.entries(t.model.vocab)),
		unk: t.model.unk_token,
	};
}

function normalize(s: string): string {
	return s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^\x20-\uFFFF]/g, "");
}

function basicTokens(s: string): string[] {
	return s
		.replace(/([^\w\s])/g, " $1 ")
		.split(/\s+/)
		.filter(Boolean);
}

function wordpiece(word: string, v: MiniVocab): string[] {
	const out: string[] = [];
	let start = 0;
	while (start < word.length) {
		let end = word.length;
		let cur: string | null = null;
		while (start < end) {
			let sub = word.slice(start, end);
			if (start > 0) sub = `##${sub}`;
			if (v.vocab.has(sub)) {
				cur = sub;
				break;
			}
			end--;
		}
		if (!cur) return [v.unk];
		out.push(cur);
		start = end;
	}
	return out;
}

/**
 * Encode un texte en IDs + masque d'attention (tronqué à `maxLen`).
 *
 * @param {string} text - Le texte à encoder.
 * @param {MiniVocab} v - Le vocabulaire (voir `loadVocab`).
 * @param {number} maxLen - Longueur max, `[CLS]`/`[SEP]` inclus (défaut : 256).
 * @returns Les `ids` et le `mask` (que des 1 : pas de padding ici).
 */
export function encode(
	text: string,
	v: MiniVocab,
	maxLen = 256,
): { ids: number[]; mask: number[] } {
	let ids: number[] = [v.vocab.get("[CLS]")!];
	for (const w of basicTokens(normalize(text))) {
		for (const p of wordpiece(w, v)) ids.push(v.vocab.get(p)!);
		if (ids.length >= maxLen - 1) break;
	}
	ids = ids.slice(0, maxLen - 1);
	ids.push(v.vocab.get("[SEP]")!);
	return { ids, mask: new Array(ids.length).fill(1) };
}
