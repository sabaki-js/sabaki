"""Parité ONNX vs PyTorch + ECE + test hors-distribution (questions inconnues)."""
import json
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

CFGS = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
tok = AutoTokenizer.from_pretrained('/tmp/sabaki/minilaya-onnx/tokenizer')
opts = ort.SessionOptions()
opts.intra_op_num_threads = 4

def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()

print('=== PARITÉ + ECE (test split) ===')
for cfg in CFGS:
    meta = json.load(open(f'/tmp/sabaki/minilaya-onnx/{cfg}.json'))
    sess = ort.InferenceSession(f'/tmp/sabaki/minilaya-onnx/{cfg}.onnx', opts)
    te = json.load(open(f'/tmp/sabaki/cache/{cfg}_test.json'))
    for q in meta['questions']:
        idx = meta['questions'].index(q)
        confs, correct = [], []
        for r in te:
            ids = tok(r['state'], return_tensors='np', truncation=True, max_length=256)
            logits = sess.run([f'logits_{q}'], {'input_ids': ids['input_ids'].astype(np.int64),
                                                'attention_mask': ids['attention_mask'].astype(np.int64)})[0][0]
            p = softmax(logits)
            gold = json.loads(r['gold'])[q]
            label = str(gold.get('label', gold.get('score')))
            pred = meta['classes'][q][int(p.argmax())]
            confs.append(float(p.max()))
            correct.append(1 if pred == label else 0)
        acc = float(np.mean(correct))
        ece = 0.0
        for b in range(10):
            sel = [c for c, cf in zip(correct, confs) if b / 10 <= cf < (b + 1) / 10 or (b == 9 and cf == 1.0)]
            if sel:
                ece += abs(np.mean(sel) - np.mean([cf for cf in confs if (b / 10 <= cf < (b + 1) / 10 or (b == 9 and cf == 1.0))])) * len(sel) / len(correct)
        print(f'{cfg} {q}: acc={acc:.3f} ECE={ece:.3f} conf_moy={np.mean(confs):.3f}', flush=True)

print('=== HORS-DISTRIBUTION (états jamais vus) ===')
ood = [
    ('customer_service', 'category', 'The dragon hoards 400 gold coins under the mountain. The wizard requests a spell refund.'),
    ('customer_service', 'category', ''),
    ('invoice_processing', 'disposition', 'My cat is sick, the veterinarian bill is 200 euros, should I pay cash?'),
    ('security_incidents', 'disposition', 'Meeting notes: coffee machine broken on floor 3, please refill beans.'),
    ('agent_trace_observability', 'outcome', 'Recette de crêpes : 250g de farine, 3 oeufs, un demi-litre de lait.'),
    ('customer_service', 'urgency', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
]
for cfg, q, state in ood:
    meta = json.load(open(f'/tmp/sabaki/minilaya-onnx/{cfg}.json'))
    sess = ort.InferenceSession(f'/tmp/sabaki/minilaya-onnx/{cfg}.onnx', opts)
    ids = tok(state or ' ', return_tensors='np', truncation=True, max_length=256)
    logits = sess.run([f'logits_{q}'], {'input_ids': ids['input_ids'].astype(np.int64),
                                        'attention_mask': ids['attention_mask'].astype(np.int64)})[0][0]
    p = softmax(logits)
    top = sorted(zip(meta['classes'][q], p), key=lambda x: -x[1])[:2]
    print(f'[{cfg}/{q}] {state[:60]!r} -> {top[0][0]} ({top[0][1]:.2f}) / {top[1][0]} ({top[1][1]:.2f})', flush=True)
