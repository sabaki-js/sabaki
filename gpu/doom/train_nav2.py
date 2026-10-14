import json, os
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel

BASE = 'sentence-transformers/all-MiniLM-L6-v2'
os.makedirs('/tmp/sabaki/navmodel2', exist_ok=True)
torch.manual_seed(42)
tok = AutoTokenizer.from_pretrained(BASE)
rows = json.load(open('/tmp/sabaki/nav/nav_map01.json')) + json.load(open('/tmp/sabaki/daggr1.json'))
CLASSES = sorted(set(r['command'] for r in rows))
print(len(rows), 'exemples, classes:', CLASSES, flush=True)

class DS(Dataset):
    def __init__(self, items):
        self.enc = tok([r['state'] for r in items], truncation=True, max_length=256, padding=True)
        self.y = torch.tensor([CLASSES.index(r['command']) for r in items])
    def __len__(self): return len(self.y)
    def __getitem__(self, i):
        return ({k: torch.tensor(v[i]) for k, v in self.enc.items()}, self.y[i])

def coll(b):
    return ({k: torch.stack([x[k] for x, _ in b]) for k in b[0][0]}, torch.stack([y for _, y in b]))

idx = list(range(len(rows)))
te_idx = {i for i in idx if i % 7 == 0}
tr = [rows[i] for i in idx if i not in te_idx]
te = [rows[i] for i in idx if i in te_idx]
dl = DataLoader(DS(tr), batch_size=32, shuffle=True, collate_fn=coll)

class Head(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = AutoModel.from_pretrained(BASE)
        self.fc = nn.Linear(384, len(CLASSES))
    def forward(self, x):
        return self.fc(self.enc(**x).last_hidden_state[:, 0])

dev = 'cuda'
net = Head().to(dev)
opt = torch.optim.AdamW(net.parameters(), lr=2e-5)
dte = DS(te)
best = -1.0
for ep in range(10):
    net.train()
    for x, y in dl:
        x = {k: v.to(dev) for k, v in x.items()}
        opt.zero_grad()
        loss = nn.functional.cross_entropy(net(x), y.to(dev))
        loss.backward()
        opt.step()
    net.eval()
    ok = 0
    with torch.no_grad():
        for i in range(len(dte)):
            x, y = dte[i]
            if net({k: v.unsqueeze(0).to(dev) for k, v in x.items()}).argmax(1).item() == y.item():
                ok += 1
    acc = ok / len(dte)
    print(f'ep{ep}: valid={acc:.3f} (n={len(dte)})', flush=True)
    if acc > best:
        best = acc
        torch.save({'model': net.state_dict(), 'classes': CLASSES}, '/tmp/sabaki/navmodel2/best.pt')
print(f'BEST valid={best:.3f}')
