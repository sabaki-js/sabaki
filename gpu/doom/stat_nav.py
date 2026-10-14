import json, collections
rows = json.load(open('/tmp/sabaki/nav/nav_map01.json'))
print(len(rows), 'exemples')
print(collections.Counter(r['command'] for r in rows))
