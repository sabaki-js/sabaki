// WordPiece minimal pour les modèles mini (vocab HF tokenizer.json, uncased).
export interface MiniVocab {
  vocab: Map<string, number>;
  unk: string;
}

export function loadVocab(tokenizerJson: unknown): MiniVocab {
  const t = tokenizerJson as { model: { vocab: Record<string, number>; unk_token: string } };
  return { vocab: new Map(Object.entries(t.model.vocab)), unk: t.model.unk_token };
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

export function encode(text: string, v: MiniVocab, maxLen = 256): { ids: number[]; mask: number[] } {
  let ids: number[] = [v.vocab.get("[CLS]")!];
  for (const w of basicTokens(normalize(text))) {
    for (const p of wordpiece(w, v)) ids.push(v.vocab.get(p)!);
    if (ids.length >= maxLen - 1) break;
  }
  ids = ids.slice(0, maxLen - 1);
  ids.push(v.vocab.get("[SEP]")!);
  return { ids, mask: new Array(ids.length).fill(1) };
}
