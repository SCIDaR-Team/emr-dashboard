import json, os
D="/Users/solomonpromise/Documents/Synterra Github Repos/emr-dashboard/public/data/"
def L(f): return json.load(open(D+f))
r2=lambda v: None if v is None else round(v,2)

nat=L("national.json"); states=L("states.json"); lgas=L("lgas.json")
fsum=L("facilities-summary.json"); reqs=L("requirements.json")
THEMES=["technical_infrastructure","workforce_capacity","workflow_transition","data_use_reporting","leadership_governance"]
BAND={"not_ready":0,"moderately_ready":1,"ready":2}

def ts(o): return [r2(o.get("themeScores",{}).get(t)) for t in THEMES]
def dist(o):
    a=o.get("archetypeDistribution",{}) or {}
    return [a.get("not_ready",0),a.get("moderately_ready",0),a.get("ready",0)]

out={}
out["nat"]={"n":nat["facilityCount"],"d":dist(nat),"ts":ts(nat),
            "sub":{k:r2(v) for k,v in nat["subThemeScores"].items()},
            "avg":r2(nat["averageScore"]),"comp":r2(nat["compositeReadiness"]),
            "inv":[{"id":i["id"],"l":i["label"],"t":i["themeId"],"p":i["priority"],
                    "c":i["category"],"q":i["quantity"],"f":i["facilityCount"],
                    "u":i["unitCostNGN"],"tc":i["totalCostNGN"]} for i in nat["investments"]]}

out["states"]=[{"id":s["id"],"nm":s["name"],"g":1 if s["evidenceGrade"]=="primary" else 0,
                "n":s["facilityCount"],"d":dist(s),"ts":ts(s),
                "avg":r2(s.get("averageScore")),"comp":r2(s.get("compositeReadiness")),
                "b":BAND.get(s.get("band")) if s.get("band") else None}
               for s in states]

out["lgas"]=[{"id":x["id"],"nm":x["name"].title(),"s":x["parentId"],"n":x["facilityCount"],
              "d":dist(x),"ts":ts(x),"avg":r2(x.get("averageScore"))} for x in lgas]

SIDX={s["id"]:i for i,s in enumerate(out["states"])}
LIDX={x["id"]:i for i,x in enumerate(out["lgas"])}
out["fac"]=[[f["name"], SIDX.get(f["stateId"],-1), LIDX.get(f["stateId"]+"."+f["lgaId"],-1),
             BAND.get(f.get("archetype")) if f.get("archetype") else None,
             r2(f.get("averageDomainScore")), f["uuid"][:8]] for f in fsum]

out["reqs"]={x["id"]:{"l":x["label"],"t":x["themeId"]} for x in reqs}

# the worked example
one=L("facilities/00019879-3b17-4d3b-884e-b22ec295b5ab.json")
out["one"]={"nm":one["name"],"state":one["state"],"lga":one["lga"].title(),
  "geo":one["geography"],"fl":one["functionalityLevel"],"oic":one["oicName"],
  "cadre":one["oicCadre"],"bhcpf":one["isBHCPF"],"cons":one["patientConsultations"],
  "avg":r2(one["averageDomainScore"]),"arch":one["archetype"],
  "ts":[{"t":t["themeId"],"s":r2(t["score"]),"b":t["band"],
         "sub":{k:r2(v) for k,v in (t.get("subThemeScores") or {}).items()}} for t in one["themeScores"]],
  "req":one["minimumRequirements"],
  "inv":[{"id":i["id"],"l":i["label"],"t":i["themeId"],"p":i["priority"],"q":i["quantity"],"u":i["unitCostNGN"]} for i in one["investments"]],
  "der":one["derived"],
  "sp":[{"l":s["label"],"present":s["present"],"dev":s["hasFunctionalDevice"],
         "dig":s["usesDigitalSystems"],"sys":s.get("digitalSystemName")} for s in one["servicePoints"]]}

geoS=json.load(open("geo-states.json")); geoL=json.load(open("geo-lgas.json"))
out["geo"]={"w":geoS["w"],"h":geoS["h"],"s":geoS["states"],"l":geoL}

js="window.EMR="+json.dumps(out,separators=(",",":"))+";"
open("data.js","w").write(js)
print("data.js bytes:", len(js))
print("states",len(out["states"]),"lgas",len(out["lgas"]),"fac",len(out["fac"]))
print("lga geo keys matched:", sum(1 for x in out["lgas"] if x["id"] in geoL), "/", len(out["lgas"]))
print("total facilities in lgas:", sum(x["n"] for x in out["lgas"]))
