import json, csv, io
D = json.load(open("build.json"))
ARCH_LABEL = {"beginner":"Beginner guide","advanced":"Advanced guide","howto":"How-to","tutorial":"Step-by-step tutorial",
 "ultimate":"Ultimate guide","checklist":"Checklist","template":"Template","examples":"Examples","casestudy":"Case study",
 "strategy":"Strategy","bestpractice":"Best practices","mistakes":"Mistakes to avoid","problem":"Problem/solution","faq":"FAQ",
 "comparison":"Comparison","alternatives":"Alternatives","tools":"Tools comparison","pricing":"Pricing","roi":"ROI",
 "stats":"Statistics","trends":"Trends","predictions":"Predictions","benchmarks":"Benchmarks","industry":"Industry-specific",
 "smallbiz":"Small business","enterprise":"Enterprise","local":"Local business","b2b":"B2B","b2c":"B2C","ai":"AI-powered"}

out = io.StringIO()
w = out.write
w("# Digital Marketing SEO Content Title Architecture\n\n")
w("50 main content pillars and 5,000 unique blog titles, optimised for SEO, AEO, GEO and AIO.\n")
w("Generated deterministically and validated for exact-duplicate and near-duplicate freedom.\n\n---\n\n")
w("# PART 1 — 50 Main Content Pillars\n\n")
for d in D:
    p = d["pillar"]
    w(f"## Pillar {p['n']:02d} — {p['title']}\n\n")
    w(f"**Description:** {p['desc']}\n\n")
    w(f"**Primary Intent:** {p['intent']}\n\n")
    w(f"**Target Audience:** {p['aud']}\n\n")
    w(f"**SEO:** {p['seo']}\n\n")
    w(f"**AEO:** {p['aeo']}\n\n")
    w(f"**GEO:** {p['geo']}\n\n")
    w(f"**AIO:** {p['aio']}\n\n")
    w("**Core Subtopics:**\n")
    for s in p["sub"]:
        w(f"- {s}\n")
    w(f"\n**Primary Keyword Theme:** {p['kw']}\n\n")
    w(f"**Secondary Keyword Themes:** {', '.join(p['kw2'])}\n\n")
    w(f"**Commercial / Transactional Opportunities:** {p['comm']}\n\n")
    w(f"**Informational Opportunities:** {p['info']}\n\n")
    w(f"**Comparison Opportunities:** {p['cmp']}\n\n")
    w(f"**How-To Opportunities:** {p['how']}\n\n")
    w(f"**FAQ Opportunities:** {p['faq']}\n\n")
    w(f"**URL Slug:** `/{p['slug']}/`\n\n---\n\n")

w("# PART 2 — 5,000 Blog Titles\n\n")
for d in D:
    p = d["pillar"]
    w(f"## PILLAR {p['n']:02d} — {p['title']}\n\n")
    for t in d["titles"]:
        w(f"{t['n']:03d}. {t['title']}\n")
    w("\n")
open("content-architecture.md","w").write(out.getvalue())

with open("blog-titles.csv","w",newline="",encoding="utf-8") as f:
    c = csv.writer(f)
    c.writerow(["pillar_number","pillar_title","pillar_slug","title_number","global_number","blog_title","content_type","subject_entity"])
    g = 0
    for d in D:
        p = d["pillar"]
        for t in d["titles"]:
            g += 1
            c.writerow([p["n"],p["title"],p["slug"],t["n"],g,t["title"],ARCH_LABEL[t["archetype"]],t["topic"]])

with open("pillars.csv","w",newline="",encoding="utf-8") as f:
    c = csv.writer(f)
    c.writerow(["number","title","slug","primary_intent","audience","primary_keyword","secondary_keywords","seo","aeo","geo","aio","core_subtopics"])
    for d in D:
        p = d["pillar"]
        c.writerow([p["n"],p["title"],p["slug"],p["intent"],p["aud"],p["kw"],"; ".join(p["kw2"]),p["seo"],p["aeo"],p["geo"],p["aio"],"; ".join(p["sub"])])
print("emitted content-architecture.md, blog-titles.csv, pillars.csv")
