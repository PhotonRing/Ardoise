#!/usr/bin/env python3
"""Génère src/data/geo.json (fond de carte simplifié d'Ardoise) à partir de Natural Earth.

Données : Natural Earth (domaine public), dépôt nvkelso/natural-earth-vector.
Récupération des seuls fichiers utiles :

    git clone --depth 1 --filter=blob:none --sparse https://github.com/nvkelso/natural-earth-vector.git scripts/geo/ne
    git -C scripts/geo/ne sparse-checkout set --no-cone /geojson/ne_50m_admin_0_countries.geojson \
        /geojson/ne_50m_lakes.geojson /geojson/ne_10m_ports.geojson /geojson/ne_10m_populated_places.geojson \
        /geojson/ne_50m_admin_0_map_units.geojson

Puis, depuis la racine du dépôt :  python3 scripts/geo/build_geo.py

Contenu produit :
  - contours des pays (1:50 M, simplifiés à ~0,6 centième de degré, coordonnées en entiers delta + varint, base64),
    noms de pays en français, rang d'affichage des étiquettes, code ADM0_A3 et variantes (codes ISO,
    noms anglais ou usuels), pays souverain et territoires détachés (map units) pour les données par pays ;
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
# Données par pays (cartes choroplèthes) : chaque pays est identifié par son code ADM0_A3 (toujours renseigné,
# unique) ; les codes ISO et les noms anglais ou usuels servent à reconnaître les pays d'un tableau collé.
AKA={'CHN':'Chine','USA':'USA|Etats-Unis d’Amérique|Amérique','GBR':'UK|Grande-Bretagne','CZE':'République tchèque',
     'COD':'RDC|Congo-Kinshasa|Congo (RDC)','COG':'Congo|Congo-Brazzaville','MMR':'Myanmar','TLS':'Timor-Leste','SWZ':'Swaziland',
     'MKD':'Macédoine','VNM':'Vietnam','BLR':'Bélarus','NLD':'Hollande','CPV':'Cabo Verde','FSM':'Micronésie','SLV':'El Salvador',
     'CAF':'Centrafrique','PSX':'Territoires palestiniens','ARE':'EAU','KNA':'Saint-Kitts-et-Nevis','VAT':'Vatican|Saint-Siège',
     'KOR':'Corée|République de Corée','PRK':'République populaire démocratique de Corée','RUS':'Fédération de Russie',
     'IRN':'République islamique d’Iran','SYR':'République arabe syrienne','LAO':'République démocratique populaire lao',
     'TZA':'République-Unie de Tanzanie','BOL':'État plurinational de Bolivie','MDA':'République de Moldavie','SXM':'Sint Maarten',
     'GNB':'Guinée Bissau','TTO':'Trinidad-et-Tobago','BIH':'Bosnie','STP':'Sao Tomé','SDS':'Sud-Soudan'}
codes={}
for f in c['features']:
    p=f['properties']
    for k in ('ISO_A3','ISO_A3_EH','ISO_A2','ISO_A2_EH'):
        v=p.get(k)
        if v and v!='-99': codes.setdefault(v,set()).add(p['ADM0_A3'])
def aliases(p):
    # codes qui ne désignent que ce pays, puis noms ; « | » sépare les variantes
    out=[]
    for k in ('ISO_A3','ISO_A3_EH','ISO_A2','ISO_A2_EH'):
        v=p.get(k)
        if v and v!='-99' and v!=p['ADM0_A3'] and len(codes[v])==1 and v not in out: out.append(v)
    for k in ('NAME','NAME_EN','NAME_LONG','ADMIN','FORMAL_EN','FORMAL_FR'):
        v=(p.get(k) or '').strip()
        if v and v!=p['NAME_FR'] and v not in out: out.append(v)
    out+= [a for a in AKA.get(p['ADM0_A3'],'').split('|') if a and a not in out]
    return '|'.join(out)
# Rattachement des territoires à leur pays souverain (option des données par pays) : SOV_A3 de Natural Earth,
# sauf rattachement indéterminé (Palestine)
sovmain={}
for f in c['features']:
    p=f['properties']
    if p['ADMIN']==p['SOVEREIGNT']: sovmain[p['SOV_A3']]=p['ADM0_A3']
def sovereign(p):
    m=sovmain.get(p['SOV_A3'])
    return m if m and m!=p['ADM0_A3'] and p['TYPE']!='Indeterminate' else 0
# Territoires détachés (Guyane, Réunion, Açores, Svalbard…) : « map units » de Natural Earth dont l'emprise ne touche
# pas celle du territoire principal ; chacun reçoit ses contours (numéros dans la liste du pays), son nom et son point
# d'étiquette, pour y répéter la valeur du pays
mu=json.load(open('ne/geojson/ne_50m_admin_0_map_units.geojson'))['features']
units={}
def bbox(pts):
    xs=[x for x,y in pts]; ys=[y for x,y in pts]; return [min(xs),min(ys),max(xs),max(ys)]
def bunion(bs): return [min(b[0] for b in bs),min(b[1] for b in bs),max(b[2] for b in bs),max(b[3] for b in bs)]
for f in mu:
    p=f['properties']
    units.setdefault(p['ADM0_A3'],[]).append({'code':p['GU_A3'],'name':p['NAME_FR'] or p['NAME'],'lx':p['LABEL_X'],'ly':p['LABEL_Y'],
        'b':bunion([bbox(poly[0]) for poly in polys(f['geometry'])])})
def inb(b,x,y,m=0): return b[0]-m<=x<=b[2]+m and b[1]-m<=y<=b[3]+m
def touch(a,b,m=0.5): return not (a[2]+m<b[0] or b[2]+m<a[0] or a[3]+m<b[1] or b[3]+m<a[1])
def detached(p,rb):
    U=units.get(p['ADM0_A3'],[])
    if len(U)<2: return []
    main=next((u for u in U if inb(u['b'],p['LABEL_X'],p['LABEL_Y'])),None) or max(U,key=lambda u:(u['b'][2]-u['b'][0])*(u['b'][3]-u['b'][1]))
    out=[]
    for u in U:
        if u is main or touch(u['b'],main['b']): continue
        idx=[i for i,(b,outer) in enumerate(rb) if outer and inb(u['b'],(b[0]+b[2])/2,(b[1]+b[3])/2,0.05)]
        if idx: out.append([u['code'],u['name'],round(u['lx'],2),round(u['ly'],2),idx])
    return out
def gap(a,b):
    # écart entre deux emprises, en degrés (longitudes prises de part et d'autre de l'antiméridien)
    dx=min(max(0,b[0]-a[2],a[0]-b[2]),max(0,b[0]+360-a[2],a[0]-b[2]-360),max(0,b[0]-360-a[2],a[0]-b[2]+360))
    return max(dx,max(0,b[1]-a[3],a[1]-b[3]))
def far_groups(p,rb,taken):
    # groupes d'îles éloignés du contour principal (Canaries, Hawaï, Alaska, Galápagos…), sans nom : à plus de 3°
    outer=[(i,b) for i,(b,o) in enumerate(rb) if o and i not in taken]
    if len(outer)<2: return []
    main=max(outer,key=lambda t:(t[1][2]-t[1][0])*(t[1][3]-t[1][1]))
    near=[main]; rest=[t for t in outer if t is not main]; grew=True
    while grew:   # tout ce qui touche (à 3° près) le territoire principal en fait partie
        grew=False
        for t in rest[:]:
            if any(gap(t[1],n[1])<=3 for n in near): near.append(t); rest.remove(t); grew=True
    groups=[]
    for t in rest:   # regroupement de proche en proche (à 3° près)
        hit=[g for g in groups if any(gap(t[1],x[1])<=3 for x in g)]
        for g in hit: groups.remove(g)
        groups.append(sum(hit,[])+[t])
    out=[]
    for g in groups:
        big=max(g,key=lambda t:(t[1][2]-t[1][0])*(t[1][3]-t[1][1]))[1]
        lx,ly=(big[0]+big[2])/2,(big[1]+big[3])/2
        out.append(['P%d_%d'%(round(lx),round(ly)),'',round(lx,2),round(ly,2),sorted(i for i,b in g)])
    return out
def parts(p,rb):
    d=detached(p,rb)
    return d+far_groups(p,rb,set(i for u in d for i in u[4]))
meta=[]; tot=0; cpolys=[]
for f in c['features']:
    p=f['properties']; rings=[]; rb=[]
    for poly in polys(f['geometry']):
        for k,r in enumerate(poly):
            n=ring(r,TOL)
            if n: rings.append(n); rb.append((bbox(r),k==0)); tot+=n
    if not rings: continue
    meta.append([p['NAME_FR'] or p['NAME'], round(p['LABEL_X'],2), round(p['LABEL_Y'],2), round(p['MIN_LABEL'] or 5,1), rings, p['ADM0_A3'], aliases(p), sovereign(p)]
                + ([parts(p,rb)] if parts(p,rb) else []))
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
