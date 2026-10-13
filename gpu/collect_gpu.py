"""Collecte soft labels via batch GPU (train + test). Même format que collect_teacher.py."""
import json, os, time, urllib.request

CFGS = ['customer_service', 'invoice_processing', 'security_incidents', 'agent_trace_observability']
os.makedirs('/tmp/sabaki/teacher', exist_ok=True)

def batch(states, questions):
    b = json.dumps({'states': states, 'questions': questions}).encode()
    for attempt in range(4):
        try:
            r = urllib.request.urlopen(
                urllib.request.Request('http://localhost:8000/v1/systemone/batch', data=b,
                                       headers={'content-type': 'application/json'}), timeout=900)
            return json.load(r)['results']
        except Exception as e:
            print('  retry', attempt, str(e)[:100], flush=True)
            time.sleep(10)
    raise RuntimeError('batch failed')

for cfg in CFGS:
    for split in ['train', 'test']:
        cp = f'/tmp/sabaki/teacher/{cfg}_{split}.json'
        if os.path.exists(cp):
            print(cfg, split, 'déjà là', flush=True)
            continue
        rows = json.load(open(f'/tmp/sabaki/cache/{cfg}_{split}.json'))
        qs = json.loads(rows[0]['questions'])
        out = []
        t0 = time.time()
        for i in range(0, len(rows), 32):
            chunk = rows[i:i + 32]
            res = batch([r['state'] for r in chunk], qs)
            for r, a in zip(chunk, res):
                out.append({'id': r['id'], 'state': r['state'],
                            'answers': {k: v.get('probabilities', {}) for k, v in a['answers'].items()}})
            print(f'{cfg} {split}: {len(out)}/{len(rows)}', flush=True)
        json.dump(out, open(cp, 'w'))
        print(f'{cfg} {split} OK en {time.time() - t0:.0f}s', flush=True)
