import json, re, collections, sys
D = json.load(open("build.json"))
STOP = set("a an the to for of in on and or with your you is are what how why when which vs".split())
def norm(s):
    return " ".join(sorted(x for x in re.sub(r"[^a-z0-9 ]"," ",s.lower()).split() if x not in STOP))

titles = [t["title"] for d in D for t in d["titles"]]
per = [len(d["titles"]) for d in D]
ex = collections.Counter(titles)
nm = collections.Counter(norm(t) for t in titles)
dup_ex = [t for t,c in ex.items() if c>1]
dup_nm = [t for t,c in nm.items() if c>1]

# per-pillar numbering must be 1..100
numbering_ok = all([t["n"] for t in d["titles"]]==list(range(1,101)) for d in D)
# all 30 archetypes present in every pillar
arch_all = {a for d in D for t in d["titles"] for a in [t["archetype"]]}
arch_missing = {d["pillar"]["n"]: sorted(arch_all - {t["archetype"] for t in d["titles"]}) for d in D}
arch_missing = {k:v for k,v in arch_missing.items() if v}

print("pillars                :", len(D), "/50", "OK" if len(D)==50 else "FAIL")
print("titles per pillar      :", sorted(set(per)), "OK" if set(per)=={100} else "FAIL")
print("total titles           :", len(titles), "/5000", "OK" if len(titles)==5000 else "FAIL")
print("exact duplicates       :", len(dup_ex), "OK" if not dup_ex else "FAIL")
print("near-duplicates        :", len(dup_nm), "OK" if not dup_nm else "FAIL")
print("numbering 1..100       :", "OK" if numbering_ok else "FAIL")
print("archetypes in corpus   :", len(arch_all), "(required 30)", "OK" if len(arch_all)==30 else "FAIL")
print("pillars missing an arch:", len(arch_missing), "OK" if not arch_missing else arch_missing)
print("unique slugs           :", len({d['pillar']['slug'] for d in D}), "OK" if len({d['pillar']['slug'] for d in D})==50 else "FAIL")
# length sanity
L=[len(t) for t in titles]
print(f"title length           : min {min(L)} / avg {sum(L)//len(L)} / max {max(L)} chars")
print("titles >95 chars       :", sum(1 for x in L if x>95))
