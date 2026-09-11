# -*- coding: utf-8 -*-
"""Deterministic 5,000-title generator: 50 pillars x 100 titles.
Each archetype+topic pair is consumed at most once, so no two titles in a pillar
share a subject-and-angle combination. A global normalised-key index rejects
near-duplicates across the whole corpus before a title is accepted."""
import sys, re, json
sys.path.insert(0, 'src')
from p01 import P as A
from p02 import P as B
from p03 import P as C
from p04 import P as D

PILLARS = A + B + C + D
YEAR = 2026

IND = ["SaaS","e-commerce","healthcare","education","real estate","hospitality",
       "financial services","travel","fitness","professional services","logistics","retail"]
SMB = ["small businesses","solo founders","local shops","startups","freelancers","family businesses"]
ENT = ["enterprise teams","large organisations","multi-brand groups","global teams","regulated industries"]
LOC = ["Nepal","Kathmandu","South Asia","emerging markets","multilingual markets"]

# (archetype key, count, [template strings])  -- {t}=topic {tool}=tool {p}=pillar noun
# {ind} {smb} {ent} {loc} {y}=year {t2}=second topic
ARCH = [
 ("beginner", 4, [
   "What Is {t}? A Beginner's Guide for {p}",
   "{t} Explained: A Plain-English Introduction",
   "Getting Started With {t}: What Beginners Need to Know First",
   "{t} for Complete Beginners: Core Concepts and First Steps"]),
 ("advanced", 3, [
   "Advanced {t}: Techniques Experienced Teams Actually Use",
   "{t} at Scale: What Changes Once You Outgrow the Basics",
   "Beyond the Basics: Sophisticated {t} Tactics That Still Work",
   "Expert-Level {t}: Edge Cases, Limits and Workarounds"]),
 ("howto", 4, [
   "How to Improve {t} Without Increasing Your Budget",
   "How to Set Up {t} Correctly the First Time",
   "How to Fix {t} When It Stops Delivering Results",
   "How to Audit Your {t} in Under an Hour"]),
 ("tutorial", 3, [
   "Step-by-Step: Building Your First {t} Workflow",
   "A Practical Walkthrough of {t}, From Setup to First Result",
   "Configuring {t} in {tool}: A Step-by-Step Tutorial",
   "{t} Tutorial: Seven Steps From Blank Page to Live"]),
 ("ultimate", 3, [
   "The Complete Guide to {t} in {y}",
   "The Definitive {t} Handbook for Modern Marketing Teams",
   "Everything You Need to Know About {t}"]),
 ("checklist", 3, [
   "The {t} Checklist Every Team Should Run Before Launch",
   "A Pre-Launch {t} Checklist You Can Finish in One Sitting",
   "Monthly {t} Maintenance Checklist for Busy Marketers"]),
 ("template", 3, [
   "A Reusable {t} Template You Can Adapt Today",
   "Free {t} Framework: Structure, Fields and Worked Example",
   "The {t} Brief Template That Cuts Revision Cycles"]),
 ("examples", 3, [
   "12 Real {t} Examples Worth Studying",
   "{t} Examples That Show What Good Actually Looks Like",
   "Annotated {t} Examples: Why Each One Works"]),
 ("casestudy", 3, [
   "Case Study: How One {ind} Brand Rebuilt Its {t}",
   "Inside a {t} Turnaround: What Changed and What It Cost",
   "A 90-Day {t} Experiment: Method, Results and Lessons"]),
 ("strategy", 4, [
   "Building a {t} Strategy That Survives Algorithm Changes",
   "A Sustainable {t} Strategy for Teams With Limited Resources",
   "How to Prioritise {t} When Everything Feels Urgent",
   "The Strategic Case for Investing in {t} This Year"]),
 ("bestpractice", 4, [
   "{t} Best Practices That Hold Up Under Scrutiny",
   "Proven {t} Principles for Consistent Results",
   "What Disciplined {t} Looks Like in Practice",
   "The {t} Standards High-Performing Teams Enforce"]),
 ("mistakes", 4, [
   "Common {t} Mistakes That Quietly Cost You Revenue",
   "Seven {t} Errors Almost Every Team Makes Early On",
   "Why Most {t} Efforts Stall, and How to Avoid It",
   "{t} Anti-Patterns Worth Unlearning"]),
 ("problem", 4, [
   "{t} Not Working? A Diagnostic Guide",
   "Troubleshooting {t}: Symptoms, Causes and Fixes",
   "What to Do When {t} Suddenly Drops",
   "Fixing Broken {t}: A Systematic Approach"]),
 ("faq", 4, [
   "{t}: Frequently Asked Questions, Answered Directly",
   "Is {t} Worth the Investment? An Honest Assessment",
   "How Long Does {t} Take to Show Results?",
   "Do You Actually Need {t}? A Decision Guide"]),
 ("comparison", 4, [
   "{t} vs {t2}: Which Deserves Your Budget?",
   "Comparing {t} and {t2}: Strengths, Limits and Overlap",
   "{t} or {t2}? A Decision Framework for Marketing Teams",
   "When to Choose {t} Over {t2}"]),
 ("alternatives", 3, [
   "Alternatives to {t}: When It Is the Wrong Tool for the Job",
   "What to Use Instead of {t} for Constrained Teams",
   "Rethinking {t}: Three Credible Alternatives"]),
 ("tools", 3, [
   "The Best Tools for {t}, Compared Honestly",
   "{tool} for {t}: Capabilities, Gaps and Fit",
   "Choosing {t} Software: Evaluation Criteria That Matter"]),
 ("pricing", 3, [
   "How Much Does {t} Really Cost in {y}?",
   "{t} Pricing Explained: What Drives the Bill",
   "Budgeting for {t}: Realistic Numbers by Company Size"]),
 ("roi", 3, [
   "Measuring the ROI of {t} Without Guesswork",
   "Does {t} Pay for Itself? A Calculation Method",
   "Proving the Business Value of {t} to Finance"]),
 ("stats", 3, [
   "{t} Statistics That Should Shape Your {y} Plan",
   "What the Data Says About {t} Performance",
   "{t} by the Numbers: Adoption, Cost and Outcomes"]),
 ("trends", 3, [
   "{t} Trends Reshaping Marketing in {y}",
   "What Changed in {t} This Year, and Why It Matters",
   "Emerging Shifts in {t} Worth Watching"]),
 ("predictions", 3, [
   "Where {t} Is Heading Next: A Considered Forecast",
   "{t} in Three Years: Reasonable Predictions, Not Hype",
   "Preparing {t} for the Post-Search Era"]),
 ("benchmarks", 3, [
   "What Is a Good {t} Benchmark? Numbers by Industry",
   "{t} Benchmarks: How to Tell Good From Average",
   "Setting Realistic {t} Targets Your Team Can Hit"]),
 ("industry", 4, [
   "{t} for {ind} Companies: What Is Different",
   "Applying {t} in {ind}: Constraints and Opportunities",
   "{ind} {t}: A Sector-Specific Playbook",
   "Why Standard {t} Advice Fails in {ind}"]),
 ("smallbiz", 3, [
   "{t} for {smb} on a Tight Budget",
   "Practical {t} When You Are the Entire Marketing Team",
   "{t} for {smb}: Start Here, Skip the Rest"]),
 ("enterprise", 3, [
   "{t} for {ent}: Governance, Scale and Sign-Off",
   "Rolling Out {t} Across {ent} Without Chaos",
   "Enterprise {t}: Coordination Costs and How to Contain Them"]),
 ("local", 3, [
   "{t} for Local Businesses in {loc}",
   "Adapting {t} for {loc}: Language, Payments and Behaviour",
   "Local-First {t}: Winning Customers Within Ten Kilometres"]),
 ("b2b", 3, [
   "{t} for B2B Teams With Long Sales Cycles",
   "How B2B Buying Committees Change Your {t} Approach",
   "{t} That Generates Pipeline, Not Just Traffic"]),
 ("b2c", 3, [
   "{t} for B2C Brands Competing on Attention",
   "High-Volume {t} for Consumer Brands",
   "{t} That Drives Repeat Purchases, Not One-Off Sales"]),
 ("ai", 4, [
   "Using AI to Improve {t} Without Losing Quality Control",
   "AI-Assisted {t}: Where It Helps and Where It Hurts",
   "Can AI Agents Handle {t} End to End?",
   "How AI Search Is Changing {t}"]),
]
assert sum(c for _, c, _ in ARCH) == 100, sum(c for _, c, _ in ARCH)


SMALL = {"a","an","and","as","at","but","by","for","from","in","into","nor","of","on","onto",
         "or","over","per","so","the","to","up","via","vs","with","without","yet","is","are","it"}
def _cap(w):
    if any(c.isupper() for c in w):   # already-cased entity, leave alone
        return w
    if "-" in w:
        return "-".join(p[:1].upper() + p[1:] if p else p for p in w.split("-"))
    return w[:1].upper() + w[1:]
def tc(s):
    """Consistent title case that respects entity casing and clause boundaries."""
    out, lead = [], True
    for tok in s.split(" "):
        if not tok:
            out.append(tok); continue
        core = tok.strip(".,:?!()")
        low = core.lower()
        if lead or low not in SMALL:
            new = _cap(core)
        else:
            new = core if any(c.isupper() for c in core) else low
        out.append(tok.replace(core, new, 1))
        lead = tok.endswith(":") or tok.endswith("?") or tok.endswith(".")
    return " ".join(out)

STOP = set("a an the to for of in on and or with your you is are what how why when which vs".split())
def norm(s):
    w = [x for x in re.sub(r"[^a-z0-9 ]", " ", s.lower()).split() if x not in STOP]
    return " ".join(sorted(w))

def build():
    seen_exact, seen_norm = set(), set()
    out, collisions = [], 0
    for p in PILLARS:
        topics, tools = p["topics"], p["tools"]
        titles, ti, used_pairs = [], 0, set()
        # interleave archetypes so a pillar reads varied rather than blocked
        slots = []
        for ak, cnt, tpls in ARCH:
            for i in range(cnt):
                slots.append((ak, tpls[i % len(tpls)]))
        for idx, (ak, tpl) in enumerate(slots):
            placed = False
            for attempt in range(len(topics) * 3):
                t = topics[(ti + attempt) % len(topics)]
                if (ak, t) in used_pairs:
                    continue
                t2 = topics[(ti + attempt + 1 + idx) % len(topics)]
                if t2 == t:
                    t2 = topics[(ti + attempt + 2 + idx) % len(topics)]
                s = (tpl.replace("{t2}", t2).replace("{t}", t)
                        .replace("{tool}", tools[idx % len(tools)])
                        .replace("{p}", tc(p["kw"]))
                        .replace("{ind}", IND[(idx + p["n"]) % len(IND)])
                        .replace("{smb}", SMB[(idx + p["n"]) % len(SMB)])
                        .replace("{ent}", ENT[(idx + p["n"]) % len(ENT)])
                        .replace("{loc}", LOC[(idx + p["n"]) % len(LOC)])
                        .replace("{y}", str(YEAR)))
                s = tc(s)
                k = norm(s)
                if s in seen_exact or k in seen_norm:
                    collisions += 1
                    continue
                seen_exact.add(s); seen_norm.add(k); used_pairs.add((ak, t))
                titles.append({"n": len(titles) + 1, "title": s, "archetype": ak, "topic": t})
                ti = (ti + attempt + 1) % len(topics)
                placed = True
                break
            if not placed:
                raise SystemExit(f"exhausted pool: pillar {p['n']} archetype {ak}")
        assert len(titles) == 100, (p["n"], len(titles))
        out.append({"pillar": p, "titles": titles})
    return out, collisions, seen_exact, seen_norm

if __name__ == "__main__":
    data, coll, ex, nm = build()
    total = sum(len(d["titles"]) for d in data)
    print(f"pillars           : {len(data)}")
    print(f"titles per pillar : {sorted({len(d['titles']) for d in data})}")
    print(f"total titles      : {total}")
    print(f"unique exact      : {len(ex)}")
    print(f"unique normalised : {len(nm)}  (near-duplicate collisions rejected during build: {coll})")
    json.dump([{ "pillar": {k: v for k, v in d["pillar"].items()}, "titles": d["titles"]} for d in data],
              open("build.json", "w"), indent=1, ensure_ascii=False)
    print("wrote build.json")
