/**
 * Charge un vocabulaire depuis un `tokenizer.json` Hugging Face.
 *
 * @param {unknown} tokenizerJson - Le contenu parsé de `tokenizer.json`.
 * @returns {MiniVocab} Le vocabulaire indexé.
 */
export function loadVocab(tokenizerJson) {
    const t = tokenizerJson;
    return {
        vocab: new Map(Object.entries(t.model.vocab)),
        unk: t.model.unk_token,
    };
}
function normalize(s) {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^\x20-\uFFFF]/g, "");
}
function basicTokens(s) {
    return s
        .replace(/([^\w\s])/g, " $1 ")
        .split(/\s+/)
        .filter(Boolean);
}
function wordpiece(word, v) {
    const out = [];
    let start = 0;
    while (start < word.length) {
        let end = word.length;
        let cur = null;
        while (start < end) {
            let sub = word.slice(start, end);
            if (start > 0)
                sub = `##${sub}`;
            if (v.vocab.has(sub)) {
                cur = sub;
                break;
            }
            end--;
        }
        if (!cur)
            return [v.unk];
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
export function encode(text, v, maxLen = 256) {
    let ids = [v.vocab.get("[CLS]")];
    for (const w of basicTokens(normalize(text))) {
        for (const p of wordpiece(w, v))
            ids.push(v.vocab.get(p));
        if (ids.length >= maxLen - 1)
            break;
    }
    ids = ids.slice(0, maxLen - 1);
    ids.push(v.vocab.get("[SEP]"));
    return { ids, mask: new Array(ids.length).fill(1) };
}
