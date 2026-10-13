"""Distillation : MiniLM gelé + têtes MLP torch sur soft labels du prof.
Sorties : mini/<cfg>_<question>.pt (W1,b1,W2,b2) + mini/report.json (acc test vs gold).
"""
import json, os
import numpy as np
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer

CFGS = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
os.makedirs('mini', exist_ok=True)
torch.manual_seed(42)

enc = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def labels(rows, q):
    return [str(json.loads(r['gold'])[q].get('label', json.loads(r['gold'])[q].get('score'))) for r in rows]

report = {}
for cfg in CFGS:
    teacher = {}
    for split in ['train', 'test']:
        for r in json.load(open(f'teacher/{cfg}_{split}.json')):
            teacher[r['id']] = r
    tr = json.load(open(f'cache/{cfg}_train.json'))
    te = json.load(open(f'cache/{cfg}_test.json'))
    Xtr = enc.encode([r['state'] for r in tr], batch_size=32, show_progress_bar=False,
                     convert_to_numpy=True).astype(np.float32)
    Xte = enc.encode([r['state'] for r in te], batch_size=32, show_progress_bar=False,
                     convert_to_numpy=True).astype(np.float32)
    mu, sd = Xtr.mean(0, keepdims=True), Xtr.std(0, keepdims=True) + 1e-6
    Xtr, Xte = (Xtr - mu) / sd, (Xte - mu) / sd
    rep = {}
    for q in sorted(json.loads(tr[0]['questions']).keys()):
        # classes = union prof + gold
        tclasses = sorted({c for r in tr if r['id'] in teacher for c in teacher[r['id']]['answers'].get(q, {})})
        gclasses = sorted(set(labels(tr, q)) | set(labels(te, q)))
        classes = sorted(set(tclasses) | set(gclasses))
        ci = {c: i for i, c in enumerate(classes)}
        # soft targets du prof (uniforme si absent)
        T = np.full((len(tr), len(classes)), 1 / len(classes), dtype=np.float32)
        for i, r in enumerate(tr):
            if r['id'] in teacher:
                probs = teacher[r['id']]['answers'].get(q, {})
                tot = sum(probs.get(c, 0) for c in classes)
                if tot > 0:
                    T[i] = np.array([probs.get(c, 0) / tot for c in classes], dtype=np.float32)
        yte = np.array([ci[str(json.loads(r['gold'])[q].get('label', json.loads(r['gold'])[q].get('score')))] for r in te])
        net = nn.Sequential(nn.Linear(Xtr.shape[1], 128), nn.ReLU(), nn.Linear(128, len(classes)))
        opt = torch.optim.Adam(net.parameters(), lr=3e-3)
        Xt = torch.from_numpy(Xtr)
        Tt = torch.from_numpy(T)
        net.train()
        for ep in range(300):
            opt.zero_grad()
            loss = -(Tt * nn.functional.log_softmax(net(Xt), dim=1)).sum(1).mean()
            loss.backward()
            opt.step()
        net.eval()
        with torch.no_grad():
            pred = net(torch.from_numpy(Xte)).argmax(1).numpy()
        acc = float((pred == yte).mean())
        rep[q] = {'acc': round(acc, 3), 'classes': classes}
        l1, l2 = net[0], net[2]
        torch.save({'W1': l1.weight.detach().numpy().round(4), 'b1': l1.bias.detach().numpy().round(4),
                    'W2': l2.weight.detach().numpy().round(4), 'b2': l2.bias.detach().numpy().round(4),
                    'mu': mu.ravel().round(4), 'sd': sd.ravel().round(4), 'classes': classes},
                   f'mini/{cfg}_{q}.pt')
        print(f'{cfg} {q}: acc={acc:.3f}', flush=True)
    report[cfg] = rep
json.dump(report, open('mini/report.json', 'w'), indent=1)
print(json.dumps(report, indent=1))
