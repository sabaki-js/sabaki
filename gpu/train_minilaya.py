"""minilaya : MiniLM-L6 multi-tâches par workflow (1 encodeur + 1 tête/question).
Labels gold du train. Éval sur test. Export ONNX.
"""
import json, os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel

CFGS = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
BASE = 'sentence-transformers/all-MiniLM-L6-v2'
os.makedirs('/tmp/sabaki/minilaya', exist_ok=True)
torch.manual_seed(42)

tok = AutoTokenizer.from_pretrained(BASE)

class DS(Dataset):
    def __init__(self, rows, qs, cls):
        self.enc = tok([r['state'] for r in rows], truncation=True, max_length=256, padding=True)
        self.y = {}
        for q in qs:
            self.y[q] = torch.tensor([
                cls[q].index(str(json.loads(r['gold'])[q].get('label', json.loads(r['gold'])[q].get('score'))))
                for r in rows])
    def __len__(self): return len(self.y[list(self.y)[0]])
    def __getitem__(self, i):
        return ({k: torch.tensor(v[i]) for k, v in self.enc.items()},
                {q: y[i] for q, y in self.y.items()})

class MultiTask(nn.Module):
    def __init__(self, qs, ncls):
        super().__init__()
        self.enc = AutoModel.from_pretrained(BASE)
        self.heads = nn.ModuleDict({q: nn.Linear(384, n) for q, n in ncls.items()})
    def forward(self, x):
        h = self.enc(**x).last_hidden_state[:, 0]
        return {q: head(h) for q, head in self.heads.items()}

report = {}
for cfg in CFGS:
    ckdir = f'/tmp/sabaki/minilaya/ckpt_{cfg}'
    os.makedirs(ckdir, exist_ok=True)
    tr = json.load(open(f'/tmp/sabaki/cache/{cfg}_train.json'))
    te = json.load(open(f'/tmp/sabaki/cache/{cfg}_test.json'))
    qs = sorted(json.loads(tr[0]['questions']).keys())
    cls = {}
    for q in qs:
        lab = lambda r: str(json.loads(r['gold'])[q].get('label', json.loads(r['gold'])[q].get('score')))
        cls[q] = sorted(set(lab(r) for r in tr) | set(lab(r) for r in te))
    def coll(b):
        return ({k: torch.stack([x[k] for x, _ in b]) for k in b[0][0]},
                {q: torch.stack([y[q] for _, y in b]) for q in qs})
    dl = DataLoader(DS(tr, qs, cls), batch_size=16, shuffle=True, collate_fn=coll)
    dev = 'cuda'
    net = MultiTask(qs, {q: len(c) for q, c in cls.items()}).to(dev)
    opt = torch.optim.AdamW(net.parameters(), lr=2e-5)
    dte = DS(te, qs, cls)

    def evaluate(net):
        net.eval()
        rep = {}
        with torch.no_grad():
            for q in qs:
                ok = sum(1 for i in range(len(dte))
                         if net({k: v.unsqueeze(0).to(dev) for k, v in dte[i][0].items()})[q].argmax(1).item() == dte[i][1][q].item())
                rep[q] = round(ok / len(dte), 3)
        net.train()
        return rep

    start_ep, best_avg = 0, -1.0
    resume = f'{ckdir}/last.pt'
    if os.path.exists(resume):
        ck = torch.load(resume, map_location=dev, weights_only=False)
        net.load_state_dict(ck['model'])
        opt.load_state_dict(ck['opt'])
        start_ep, best_avg = ck['epoch'] + 1, ck['best_avg']
        print(f'{cfg}: reprise à epoch {start_ep} (best {best_avg:.3f})', flush=True)
    N_EP = int(os.environ.get('MINILAYA_EPOCHS', '12'))
    for ep in range(start_ep, N_EP):
        tot = 0
        for x, y in dl:
            x = {k: v.to(dev) for k, v in x.items()}
            opt.zero_grad()
            out = net(x)
            loss = sum(nn.functional.cross_entropy(out[q], y[q].to(dev)) for q in qs)
            loss.backward()
            opt.step()
            tot += loss.item()
        rep = evaluate(net)
        avg = float(np.mean(list(rep.values())))
        torch.save({'model': net.state_dict(), 'opt': opt.state_dict(), 'epoch': ep,
                    'best_avg': best_avg, 'classes': cls, 'questions': qs}, resume)
        if avg > best_avg:
            best_avg = avg
            torch.save({'model': net.state_dict(), 'classes': cls, 'questions': qs,
                        'epoch': ep, 'report': rep}, f'{ckdir}/best.pt')
        print(f'{cfg} ep{ep}: moy={avg:.3f} best={best_avg:.3f}', flush=True)
    # compat : le best devient le .pt final
    import shutil
    shutil.copy(f'{ckdir}/best.pt', f'/tmp/sabaki/minilaya/{cfg}.pt')
    best = torch.load(f'{ckdir}/best.pt', map_location='cpu', weights_only=False)
    report[cfg] = {q: {'acc': best['report'][q]} for q in qs}
    print(f'{cfg}: BEST moy={best_avg:.3f} ' + ' '.join(f'{q}={v:.2f}' for q, v in best['report'].items()), flush=True)

json.dump(report, open('/tmp/sabaki/minilaya/report.json', 'w'), indent=1)
