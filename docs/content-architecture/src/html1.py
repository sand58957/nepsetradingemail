import json
D = json.load(open("build.json"))
ARCH = {"beginner":"Beginner guide","advanced":"Advanced guide","howto":"How-to","tutorial":"Tutorial",
 "ultimate":"Ultimate guide","checklist":"Checklist","template":"Template","examples":"Examples","casestudy":"Case study",
 "strategy":"Strategy","bestpractice":"Best practices","mistakes":"Mistakes","problem":"Problem/solution","faq":"FAQ",
 "comparison":"Comparison","alternatives":"Alternatives","tools":"Tools","pricing":"Pricing","roi":"ROI",
 "stats":"Statistics","trends":"Trends","predictions":"Predictions","benchmarks":"Benchmarks","industry":"Industry",
 "smallbiz":"Small business","enterprise":"Enterprise","local":"Local","b2b":"B2B","b2c":"B2C","ai":"AI-powered"}
KEYS = list(ARCH.keys())
CH = {"Email":[14,15,16,17,18],"WhatsApp":[19,20,21,22],"SMS":[23,24,25],"Telegram":[26,27,28],
      "Messenger":[29,30,31],"Blog CMS":[32,33,34],"Search":[2,3,4,5,8,9,10,11,12,13],
      "AI & answer engines":[35,36,37],"Growth & demand":[1,6,7,38,39,40,41,42,43,44,45,46,47,48,49,50]}
GRP = {}
for g, ns in CH.items():
    for n in ns: GRP[n] = g
payload = {"arch": [ARCH[k] for k in KEYS], "pillars": []}
for d in D:
    p = d["pillar"]
    payload["pillars"].append({
        "n": p["n"], "t": p["title"], "s": p["slug"], "g": GRP.get(p["n"], "Growth & demand"),
        "d": p["desc"], "i": p["intent"], "a": p["aud"], "kw": p["kw"], "kw2": p["kw2"],
        "seo": p["seo"], "aeo": p["aeo"], "geo": p["geo"], "aio": p["aio"], "sub": p["sub"],
        "items": [[t["title"], KEYS.index(t["archetype"])] for t in d["titles"]]})
open("payload.json","w").write(json.dumps(payload, separators=(",",":"), ensure_ascii=False))
print("payload bytes:", len(open("payload.json").read()))
print("groups:", {g: len(ns) for g, ns in CH.items()}, "sum", sum(len(v) for v in CH.values()))
