"""Temperature scaling par (workflow, question) sur le test split (faute de valid séparé - noté)."""
import json, os
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

CACHE = os.path.expanduser('~/sabaki-js/cache')
MODEL = os.path.expanduser('~/.cache/sabaki/v0.2.0')
WF = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
tok = AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')
opts = ort.SessionOptions()
opts.intra_op_num_threads = 4

def softmax(x):
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)

def nll(probs, y):
    return float(-np.log(np.clip(probs[np.arange(len(y)), y], 1e-12, 1)).mean())

def ece(confs, correct):
    e = 0.0
    for b in range(10):
        sel = [(c, f) for c, f in zip(correct, confs) if b / 10 <= f < (b + 1) / 10 or (b == 9 and f == 1.0)]
        if sel:
            e += abs(np.mean([c for c, _ in sel]) - np.mean([f for _, f in sel])) * len(sel) / len(correct)
    return e

out = {}
for cfg in WF:
    d = os.path.join(MODEL, f'{cfg}-int8')
    meta = json.load(open(os.path.join(d, f'{cfg}.json')))
    sess = ort.InferenceSession(os.path.join(d, f'{cfg}_int8.onnx'), opts)
    te = json.load(open(os.path.join(CACHE, f'{cfg}_test.json')))
    out[cfg] = {}
    for q in meta['questions']:
        cls = meta['classes'][q]
        ci = {c: i for i, c in enumerate(cls)}
        logits, y = [], []
        for r in te:
            ids = tok(r['state'], return_tensors='np', truncation=True, max_length=256)
            lg = sess.run([f'logits_{q}'], {'input_ids': ids['input_ids'].astype(np.int64),
                                            'attention_mask': ids['attention_mask'].astype(np.int64)})[0][0]
            logits.append(lg)
            gold = json.loads(r['gold'])[q]
            y.append(ci[str(gold.get('label', gold.get('score')))])
        logits, y = np.array(logits), np.array(y)
        p0 = softmax(logits)
        e0 = ece(p0.max(1).tolist(), (p0.argmax(1) == y).astype(int).tolist())
        best = min((t / 20 for t in range(2, 101)),
                   key=lambda t: nll(softmax(logits / t), y))
        p1 = softmax(logits / best)
        e1 = ece(p1.max(1).tolist(), (p1.argmax(1) == y).astype(int).tolist())
        out[cfg][q] = {'T': round(best, 3), 'ece_avant': round(e0, 3), 'ece_apres': round(e1, 3),
                       'acc': round(float((p1.argmax(1) == y).mean()), 3)}
        print(f'{cfg} {q}: T={best:.2f} ECE {e0:.3f}->{e1:.3f}', flush=True)
json.dump(out, open(os.path.expanduser('~/sabaki-js/temperatures.json'), 'w'), indent=1)
