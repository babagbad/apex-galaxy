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
# ---- outliers: players who rank way higher on one axis than on the GOAT score ----
# Per sport and per axis: top 50 on that axis, then the 5 with the biggest gap
# between their axis rank and their GOAT rank (gap of at least 8 spots).
# They get added to the default view if they weren't already in it.
OUT = {}
for sport, g in R.groupby('sport'):
    gr = g.goat.rank(ascending=False)
    for code, col in [('L', 'length'), ('H', 'height_std'), ('S', 'separation_std')]:
        ar = g[col].rank(ascending=False, method='min')
        gap = (gr - ar)[ar <= 50]
        for pid, v in gap[gap >= 8].sort_values(ascending=False).head(5).items():
            OUT.setdefault(g.loc[pid, 'pid'], code)
# a few I wanted in by hand
for nm, code in [('Derrick Rose', 'H')]:
    OUT[R.loc[R['name'] == nm, 'pid'].iloc[0]] = code
out = []
for _, r in R.iterrows():
    c = C.loc[r.pid]
    out.append({
        'i': r.pid, 'n': r['name'], 's': r.sport, 'pos': clean(r.pos), 'nat': clean(r.nat),
        'by': None if pd.isna(r['by']) else int(r['by']),
        'y0': int(r.y0), 'y1': int(r.y1), 'py': int(r.peak_year), 'nq': int(r.nq), 'n1': int(r.n1),
        'hz': round(float(r.height_std), 3), 'lz': round(float(r.length_std), 3), 'sz': round(float(r.separation_std), 3),
        'L': int(r.length), 'act': bool(c.active), 'cur': bool(c.curated) or r.pid in OUT,
        'o': OUT.get(r.pid),
        'c': spark.get(r.pid, []),
    })
json.dump(out, open('public/athletes.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'in default view:', sum(a['cur'] for a in out), 'outliers:', len(OUT), 'added:', sum(1 for a in out if a['o'] and not C.loc[a['i']].curated))
