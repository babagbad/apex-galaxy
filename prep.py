import pandas as pd, json, re
P='/tmp/master/APEX_MASTER/data/'
d=pd.read_csv(P+'processed/all_players_ranked.csv')
r=pd.read_csv(P+'raw/all_seasons_raw.csv',low_memory=False)
r=r.dropna(subset=['season_year','season_apex_score'])
g=r.groupby('player_id')
span=g.season_year.agg(['min','max','count'])
car={pid:[[int(y),round(float(s),1)] for y,s in zip(x.season_year,x.season_apex_score)] for pid,x in g[['season_year','season_apex_score']].__iter__() for x in [x.sort_values('season_year')]}
def py(s):
    m=re.match(r'(\d{4})',str(s)); return int(m.group(1)) if m else None
out=[]
for _,p in d.iterrows():
    pid=p.player_id; sp=span.loc[pid] if pid in span.index else None
    out.append({'i':pid,'n':p['name'],'s':p.sport,
      'nat':None if pd.isna(p.nationality) else p.nationality,
      'pos':None if pd.isna(p.position) else p.position,
      'by':None if pd.isna(p.birth_year) else int(p.birth_year),
      'pk':round(p.x_peak_ceiling,2),'su':round(p.y_sustained_floor,2),'cl':round(p.z_clutch_elevation,2),
      'g':round(p.goat_score,2),'ps':round(p.peak_score,1),'ss':round(p.sustained_score,1),
      'sr':int(p.sport_rank),'gr':int(p.global_rank),'psn':None if pd.isna(p.peak_season) else str(p.peak_season),
      'py':py(p.peak_season),
      'y0':None if sp is None else int(sp['min']),'y1':None if sp is None else int(sp['max']),'nS':0 if sp is None else int(sp['count']),
      'c':car.get(pid,[])})
json.dump(out,open('public/athletes.json','w'),separators=(',',':'))
print(len(out), sum(1 for o in out if o['py'] is None), sum(1 for o in out if not o['c']))
