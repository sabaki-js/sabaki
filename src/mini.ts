// Runtime mode mini (ONNX). onnxruntime-node en dépendance optionnelle :
// importé dynamiquement pour garder le core à zéro dépendance en mode nano.
import { encode, loadVocab } from "./wordpiece.js";

export interface MiniModel {
  run: (state: string, question: string) => Promise<{ decision: string; confidence: number }>;
}

function softmax(a: number[]): number[] {
  const m = Math.max(...a);
  const e = a.map((x) => Math.exp(x - m));
  const s = e.reduce((x, y) => x + y, 0);
  return e.map((x) => x / s);
}

export async function loadMini(modelDir: string): Promise<MiniModel> {
  const [{ default: ort }, fs, path] = await Promise.all([
    import("onnxruntime-node").catch(() => {
      throw new Error("mode mini requiert onnxruntime-node : npm i onnxruntime-node");
    }),
    import("fs"),
    import("path"),
  ]);
  const { model, config } = JSON.parse(
    fs.readFileSync(path.join(modelDir, "model.json"), "utf8"),
  ) as { model: string; config: { questions: string[]; classes: Record<string, string[]> } };
  const vocab = loadVocab(
    JSON.parse(fs.readFileSync(path.join(modelDir, "tokenizer.json"), "utf8")),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const sess = await ort.InferenceSession.create(path.join(modelDir, model), {
    intraOpNumThreads: 4,
  });
  return {
    run: async (state: string, question: string) => {
      const { ids, mask } = encode(state, vocab);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const Tensor = ort.Tensor;
      const feeds = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        input_ids: new Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        attention_mask: new Tensor("int64", BigInt64Array.from(mask.map(BigInt)), [1, mask.length]),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const out = (await sess.run(feeds)) as Record<string, { data: ArrayLike<number> }>;
      const p = softmax(Array.from(out[`logits_${question}`]!.data));
      let bi = 0;
      p.forEach((v, i) => {
        if (v > p[bi]!) bi = i;
      });
      return {
        decision: config.classes[question]![bi]!,
        confidence: Math.round(p[bi]! * 1000) / 1000,
      };
    },
  };
}
