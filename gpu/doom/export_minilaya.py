"""Exporte les 4 modèles minilaya en ONNX (opset 14), avec vocab + config pour le runtime TS."""
import json, os
import torch
from transformers import AutoTokenizer

CFGS = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
os.makedirs('/tmp/sabaki/minilaya-onnx', exist_ok=True)
tok = AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')
tok.save_pretrained('/tmp/sabaki/minilaya-onnx/tokenizer')

import sys
sys.path.insert(0, '/tmp/sabaki')
from train_minilaya import MultiTask  # noqa

class TupleOut(torch.nn.Module):
    def __init__(self, net, order):
        super().__init__()
        self.net = net
        self.order = order
    def forward(self, input_ids, attention_mask):
        out = self.net({'input_ids': input_ids, 'attention_mask': attention_mask})
        return tuple(out[q] for q in self.order)

for cfg in CFGS:
    ckpt = torch.load(f'/tmp/sabaki/minilaya/{cfg}.pt', map_location='cpu', weights_only=False)
    net = MultiTask(ckpt['questions'], {q: len(c) for q, c in ckpt['classes'].items()})
    net.load_state_dict(ckpt['model'])
    net.eval()
    wrapped = TupleOut(net, ckpt['questions'])
    ids = tok('test state', return_tensors='pt')
    torch.onnx.export(
        wrapped, (ids['input_ids'], ids['attention_mask']),
        f'/tmp/sabaki/minilaya-onnx/{cfg}.onnx',
        input_names=['input_ids', 'attention_mask'],
        output_names=[f'logits_{q}' for q in ckpt['questions']],
        dynamic_axes={'input_ids': {0: 'batch', 1: 'seq'}, 'attention_mask': {0: 'batch', 1: 'seq'}},
        dynamo=True)
    json.dump({'questions': ckpt['questions'], 'classes': ckpt['classes']},
              open(f'/tmp/sabaki/minilaya-onnx/{cfg}.json', 'w'))
    print(cfg, 'exporté', flush=True)
