"""Builds public/athletes.json for the galaxy from the APEX v6 pipeline output.
Fields are short to keep the file small. See ARCHITECTURE.md for the key."""
import json, math, pandas as pd, numpy as np
V6 = '/home/user/workspace/apex-v6'
R = pd.read_pickle(f'{V6}/ranked.pkl')
C = pd.read_csv(f'{V6}/athletes_v6.csv').set_index('pid')
Z = pd.read_pickle(f'{V6}/season_z.pkl')
spark = Z.groupby('pid').apply(lambda g: [[int(y), round(float(z), 2)] for y, z in sorted(zip(g.year, g.z))], include_groups=False).to_dict()
def clean(x):
    if x is None or (isinstance(x, float) and math.isnan(x)): return None
    return x
out = []
for _, r in R.iterrows():
    c = C.loc[r.pid]
    out.append({
        'i': r.pid, 'n': r['name'], 's': r.sport, 'pos': clean(r.pos), 'nat': clean(r.nat),
        'by': None if pd.isna(r['by']) else int(r['by']),
        'y0': int(r.y0), 'y1': int(r.y1), 'py': int(r.peak_year), 'nq': int(r.nq), 'n1': int(r.n1),
        'hz': round(float(r.height_std), 3), 'lz': round(float(r.length_std), 3), 'sz': round(float(r.separation_std), 3),
        'L': int(r.length), 'act': bool(c.active), 'cur': bool(c.curated),
        'c': spark.get(r.pid, []),
    })
json.dump(out, open('public/athletes.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), sum(a['cur'] for a in out))
