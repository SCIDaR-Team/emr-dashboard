import json, math, sys
SRC="/Users/solomonpromise/Documents/Synterra Github Repos/emr-dashboard/public/geo/"

def rings(geom):
    t,c=geom["type"],geom["coordinates"]
    if t=="Polygon": return c
    if t=="MultiPolygon": return [r for poly in c for r in poly]
    return []

def perp(p,a,b):
    (x,y),(x1,y1),(x2,y2)=p,a,b
    dx,dy=x2-x1,y2-y1
    if dx==0 and dy==0: return math.hypot(x-x1,y-y1)
    t=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)))
    return math.hypot(x-(x1+t*dx), y-(y1+t*dy))

def dp(pts,tol):
    if len(pts)<3: return pts
    dmax,idx=0,0
    for i in range(1,len(pts)-1):
        d=perp(pts[i],pts[0],pts[-1])
        if d>dmax: dmax,idx=d,i
    if dmax>tol:
        return dp(pts[:idx+1],tol)[:-1]+dp(pts[idx:],tol)
    return [pts[0],pts[-1]]

def load(fn):
    return json.load(open(SRC+fn))

# ---- bounds from the states file (the national frame both maps share) ----
st=load("nigeria-states.geojson")
xs=[];ys=[]
for f in st["features"]:
    for r in rings(f["geometry"]):
        for x,y in r: xs.append(x); ys.append(y)
lon0,lon1,lat0,lat1=min(xs),max(xs),min(ys),max(ys)
mlat=math.radians((lat0+lat1)/2)
k=math.cos(mlat)
W=1000.0
sx=W/((lon1-lon0)*k)
H=(lat1-lat0)*sx
def proj(x,y):
    return ((x-lon0)*k*sx, (lat1-y)*sx)

def paths(features, namekey, tol, minarea):
    out={}
    for f in features:
        nm=f["properties"].get(namekey)
        if not nm: continue
        segs=[]
        for r in rings(f["geometry"]):
            p=[proj(x,y) for x,y in r]
            # drop slivers (islands/artefacts) by bbox area
            bx=max(q[0] for q in p)-min(q[0] for q in p)
            by=max(q[1] for q in p)-min(q[1] for q in p)
            if bx*by < minarea: continue
            p=dp(p,tol)
            if len(p)<4: continue
            segs.append("M"+"L".join(f"{a:.1f},{b:.1f}" for a,b in p)+"Z")
        if segs: out[nm.strip()]="".join(segs)
    return out

sys.setrecursionlimit(100000)
S=paths(st["features"],"statename",1.4,6.0)
lg=load("nigeria-lgas.geojson")
print("lga props:", json.dumps(lg["features"][0]["properties"])[:300], file=sys.stderr)
json.dump({"w":round(W),"h":round(H),"states":S}, open("geo-states.json","w"))
print(f"viewBox 0 0 {W:.0f} {H:.0f}  states={len(S)}  bytes={len(json.dumps(S))}")

PRIMARY={"lagos","oyo","nasarawa","jigawa","rivers","anambra","imo","adamawa","bauchi","kano","niger","akwa ibom","akwa-ibom","akwaibom"}
feats=[f for f in lg["features"] if (f["properties"].get("stateId") or "").lower().replace("_","-") in PRIMARY]
print("lga feats in primary states:", len(feats))
L={}
for f in feats:
    p=f["properties"]
    key=p["stateId"]+"."+p["lgaId"]
    segs=[]
    for r in rings(f["geometry"]):
        q=[proj(x,y) for x,y in r]
        bx=max(a[0] for a in q)-min(a[0] for a in q)
        by=max(a[1] for a in q)-min(a[1] for a in q)
        if bx*by<1.0: continue
        q=dp(q,0.5)
        if len(q)<4: continue
        segs.append("M"+"L".join(f"{a:.1f},{b:.1f}" for a,b in q)+"Z")
    if segs: L[key]={"n":p["name"],"s":p["stateId"],"d":"".join(segs)}
json.dump(L, open("geo-lgas.json","w"))
print(f"lgas={len(L)} bytes={len(json.dumps(L))}")
