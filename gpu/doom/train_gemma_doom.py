"""Gemma-3-270M + classification head on doomLaya v3 (category, 7 classes)."""
import json, os
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForCausalLM

BASE = os.environ.get("STUDENT", "google/gemma-3-270m")
os.makedirs("/tmp/sabaki/gemma-doom", exist_ok=True)
torch.manual_seed(42)
tok = AutoTokenizer.from_pretrained(BASE)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token

tr = json.load(open("/tmp/doom/training/v3/train.json"))
va = json.load(open("/tmp/doom/training/v3/validation.json"))
CLASSES = sorted(set(r["category"] for r in tr))
print("classes:", CLASSES, flush=True)

class DS(Dataset):
    def __init__(self, rows):
        self.enc = tok([r["state"] for r in rows], truncation=True, max_length=512, padding=True)
        self.y = torch.tensor([CLASSES.index(r["category"]) for r in rows])
    def __len__(self): return len(self.y)
    def __getitem__(self, i):
        return ({k: torch.tensor(v[i]) for k, v in self.enc.items()}, self.y[i])

class Head(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = AutoModelForCausalLM.from_pretrained(BASE)
        self.fc = nn.Linear(self.enc.config.hidden_size, len(CLASSES))
    def forward(self, x):
        h = self.enc(**x).logits[:, -1]
        return self.fc(h)

def coll(b):
    return ({k: torch.stack([x[k] for x, _ in b]) for k in b[0][0]}, torch.stack([y for _, y in b]))

dev = "cuda"
net = Head().to(dev)
opt = torch.optim.AdamW(net.parameters(), lr=2e-5)
dl = DataLoader(DS(tr), batch_size=8, shuffle=True, collate_fn=coll)
dv = DS(va)

def evaluate():
    net.eval()
    ok = 0
    with torch.no_grad():
        for i in range(len(dv)):
            x, y = dv[i]
            if net({k: v.unsqueeze(0).to(dev) for k, v in x.items()}).argmax(1).item() == y.item():
                ok += 1
    net.train()
    return ok / len(dv)

best = -1.0
for ep in range(10):
    for x, y in dl:
        x = {k: v.to(dev) for k, v in x.items()}
        opt.zero_grad()
        loss = nn.functional.cross_entropy(net(x), y.to(dev))
        loss.backward()
        opt.step()
    acc = evaluate()
    print(f"ep{ep}: valid={acc:.3f}", flush=True)
    if acc > best:
        best = acc
        torch.save({"model": net.state_dict(), "classes": CLASSES, "epoch": ep, "acc": acc},
                   "/tmp/sabaki/gemma-doom/best.pt")
print(f"BEST valid={best:.3f}")
