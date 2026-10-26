#!/usr/bin/env python3
"""Génère src/data/geo.json (fond de carte simplifié d'Ardoise) à partir de Natural Earth.

Données : Natural Earth (domaine public), dépôt nvkelso/natural-earth-vector.
Récupération des seuls fichiers utiles :

    git clone --depth 1 --filter=blob:none --sparse https://github.com/nvkelso/natural-earth-vector.git scripts/geo/ne
    git -C scripts/geo/ne sparse-checkout set --no-cone /geojson/ne_50m_admin_0_countries.geojson \
        /geojson/ne_50m_lakes.geojson /geojson/ne_10m_ports.geojson /geojson/ne_10m_populated_places.geojson

Puis, depuis la racine du dépôt :  python3 scripts/geo/build_geo.py

Contenu produit :
  - contours des pays (1:50 M, simplifiés à ~0,6 centième de degré, coordonnées en entiers delta + varint, base64),
    noms de pays en français et rang d'affichage des étiquettes ;
  - grands lacs ;
  - ~1 000 ports nommés (avec leur pays) et ~7 300 villes (nom local, nom français, pays, population en milliers,
    zoom minimal d'affichage, capitale), pour la recherche et l'affichage.
"""
import json, base64, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
NE = os.path.join(HERE, 'ne')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'geo.json')
os.chdir(HERE)
if not os.path.isdir(os.path.join(NE, 'geojson')):
    sys.exit('Données Natural Earth absentes : voir les instructions en tête de ce script.')

import json, base64, math
Q=100  # 0,01° ≈ 1,1 km
def polys(g):
    return g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
def dp(pts,tol):
    if len(pts)<5: return pts
    keep=[False]*len(pts); keep[0]=keep[-1]=True; st=[(0,len(pts)-1)]
    while st:
        a,b=st.pop(); ax,ay=pts[a]; bx,by=pts[b]; dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy)
        best,bi=-1,-1
        for i in range(a+1,b):
            px,py=pts[i]
            d=abs(dy*(px-ax)-dx*(py-ay))/L if L else math.hypot(px-ax,py-ay)
            if d>best: best,bi=d,i
        if best>tol: keep[bi]=True; st+=[(a,bi),(bi,b)]
    return [p for p,k in zip(pts,keep) if k]
out=bytearray()
def varint(n):
    n=(n<<1)^(n>>63)  # zigzag
    while True:
        b=n&0x7f; n>>=7
        if n: out.append(b|0x80)
        else: out.append(b); break
def ring(r,tol):
    q=[(round(x*Q),round(y*Q)) for x,y in r]
    q=dp(q,tol)
    d=[q[0]]+[p for i,p in enumerate(q[1:],1) if p!=q[i-1]]
    if len(d)<4: return 0
    px=py=0
    for x,y in d: varint(x-px); varint(y-py); px,py=x,y
    return len(d)
TOL=0.6  # en centièmes de degré
c=json.load(open('ne/geojson/ne_50m_admin_0_countries.geojson'))
meta=[]; tot=0; cpolys=[]
for f in c['features']:
    p=f['properties']; rings=[]
    for poly in polys(f['geometry']):
        for r in poly:
            n=ring(r,TOL)
            if n: rings.append(n); tot+=n
    if not rings: continue
    meta.append([p['NAME_FR'] or p['NAME'], round(p['LABEL_X'],2), round(p['LABEL_Y'],2), round(p['MIN_LABEL'] or 5,1), rings])
    cpolys.append((p['NAME_FR'] or p['NAME'], polys(f['geometry'])))
lakes=json.load(open('ne/geojson/ne_50m_lakes.geojson')); lk=[]
for f in lakes['features']:
    if f['properties']['scalerank']>2: continue
    for poly in polys(f['geometry']):
        n=ring(poly[0],TOL)
        if n: lk.append(n); tot+=n
# ports + pays par point dans polygone
def inring(x,y,r):
    ins=False; j=len(r)-1
    for i in range(len(r)):
        xi,yi=r[i]; xj,yj=r[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi: ins=not ins
        j=i
    return ins
def country(x,y):
    best=None;bd=9e9
    for name,pp in cpolys:
        for poly in pp:
            if inring(x,y,poly[0]): return name
            for (a,b) in poly[0][::3]:
                d=(a-x)**2+(b-y)**2
                if d<bd: bd,best=d,name
    return best if bd<0.5 else ''
pr=json.load(open('ne/geojson/ne_10m_ports.geojson')); ports=[]
for f in pr['features']:
    n=(f['properties']['name'] or '').strip()
    if not n: continue
    x,y=f['geometry']['coordinates']
    ports.append([n, round(x,3), round(y,3), country(x,y)])
ports.sort(key=lambda p:p[0])
geo={'q':Q,'countries':meta,'lakes':lk,'ports':ports,'data':base64.b64encode(bytes(out)).decode(),
     'src':'Natural Earth (domaine public)'}

g = geo
d=json.load(open('ne/geojson/ne_10m_populated_places.geojson'))['features']
c=json.load(open('ne/geojson/ne_50m_admin_0_countries.geojson'))['features']
iso={}; names={}
for keys in (('ADMIN','NAME'),('NAME_LONG','GEOUNIT'),('SOVEREIGNT',)):
    for f in c:
        p=f['properties']; fr=p['NAME_FR'] or p['NAME']
        for k in keys:
            if p.get(k): names.setdefault(p[k],fr)
for f in c:
    p=f['properties']; fr=p['NAME_FR'] or p['NAME']
    if p.get('ISO_A2') not in (None,'-99'): iso.setdefault(p['ISO_A2'],fr)
    if p.get('ISO_A2_EH') not in (None,'-99'): iso.setdefault(p['ISO_A2_EH'],fr)
def cfr(p): return iso.get(p['ISO_A2']) or names.get(p['ADM0NAME']) or p['ADM0NAME']
rows=[]
for f in d:
    p=f['properties']
    if p['FEATURECLA'] in ('Scientific station','Meteorological Station','Historic place'): continue
    x,y=f['geometry']['coordinates']; nf=p.get('NAME_FR') or ''
    rows.append([p['NAME'], nf if nf and nf!=p['NAME'] else 0, round(x,3), round(y,3), cfr(p), round((p['POP_MAX'] or 0)/1000), round((p['MIN_ZOOM'] or 10)*10), 1 if p['FEATURECLA'].startswith('Admin-0') else 0])
cn=sorted(set([r[4] for r in rows]+[p[3] for p in g['ports'] if p[3]]))
ci={n:i for i,n in enumerate(cn)}
g['cn']=cn
g['cities']=[[r[0],r[1],r[2],r[3],ci[r[4]],r[5],r[6]]+([1] if r[7] else []) for r in sorted(rows,key=lambda r:-r[5])]
g['ports']=[[p[0],p[1],p[2],ci[p[3]] if p[3] else -1] for p in g['ports']]

s = json.dumps(g, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
open(OUT, 'w').write(s)
print('src/data/geo.json :', len(s) // 1024, 'Ko —', len(g['countries']), 'pays,', len(g['cities']), 'villes,', len(g['ports']), 'ports')
