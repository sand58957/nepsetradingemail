# Emits idempotent seed SQL from the internal content-title database (build.json)
# + the local Flyier assets. No external source is consulted.
import json, os, re, unicodedata

D = json.load(open("build.json"))
FLYDIR = "/Users/sandeep/Downloads/Nepal_filling/Flyier/png"
flyers = {}
for fn in os.listdir(FLYDIR):
    if fn.lower().endswith(".png"):
        m = re.match(r"^(\d{2}) ", fn)
        if m:
            flyers[int(m.group(1))] = fn
assert len(flyers) == 50, f"expected 50 flyers, found {len(flyers)}"

# Only the six category slugs that already exist. Canonical id = lowest per slug.
CAT = {"digital-marketing":1,"social-media-marketing":2,"sms-marketing":15,
       "whatsapp-marketing":19,"telegram-marketing":23,"messenger-marketing":27}
def cat_for(n):
    if n in (23,24,25): return CAT["sms-marketing"]
    if n in (19,20,21,22): return CAT["whatsapp-marketing"]
    if n in (26,27,28): return CAT["telegram-marketing"]
    if n in (29,30,31): return CAT["messenger-marketing"]
    if n == 41: return CAT["social-media-marketing"]
    return CAT["digital-marketing"]

def q(s):
    return "'" + str(s).replace("'", "''") + "'"
def arr(xs):
    return "ARRAY[" + ",".join(q(x) for x in xs) + "]::TEXT[]" if xs else "'{}'::TEXT[]"
def key(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode()
    return re.sub(r"[^a-z0-9]+"," ", s.lower()).strip()

out = []
w = out.append
w("-- Seed: 50 internal content pillars + 5,000 internal blog titles.")
w("-- Idempotent: re-running updates metadata and leaves title status untouched.")
w("-- Account to seed. Override with: psql -v acct=N")
w("\\if :{?acct}")
w("\\else")
w("\\set acct 20")
w("\\endif")
w("BEGIN;")
w("")
w("-- The two permitted authors. Sandeep already exists; Tarkaraj is created once")
w("-- because author rotation requires both. No other author is ever created.")
w("UPDATE blog_authors SET bio = COALESCE(NULLIF(bio,''), 'Digital marketing practitioner writing on multi-channel campaign strategy.'),")
w("       social_links = COALESCE(social_links,'{}'::jsonb) || '{\"website\":\"https://sandeepkumarchaudhary.com/\"}'::jsonb")
w(" WHERE id = 1;")
w("INSERT INTO blog_authors (account_id, name, slug, bio, expertise, social_links, is_active)")
w("SELECT :acct, 'Tarkaraj Jaisi', 'tarkaraj-jaisi',")
w("       'Digital marketing practitioner writing on search, content and messaging channels.',")
w("       ARRAY['SEO','Content Marketing','Messaging Channels']::TEXT[],")
w("       '{\"website\":\"https://tarkarajjaishi.com.np/\"}'::jsonb, TRUE")
w("WHERE NOT EXISTS (SELECT 1 FROM blog_authors WHERE slug = 'tarkaraj-jaisi');")
w("")
w("-- Runtime defaults: 30-minute interval, disabled until an admin starts it.")
w("INSERT INTO blog_title_bank_settings (account_id, is_enabled, interval_minutes, author_ids, site_base_url)")
w("SELECT :acct, FALSE, 30,")
w("       ARRAY[(SELECT id FROM blog_authors WHERE slug='sandeep-kumar-chaudhary' ORDER BY id LIMIT 1),")
w("             (SELECT id FROM blog_authors WHERE slug='tarkaraj-jaisi' ORDER BY id LIMIT 1)]::INTEGER[],")
w("       'https://nepalfillings.com'")
w("WHERE NOT EXISTS (SELECT 1 FROM blog_title_bank_settings WHERE account_id = :acct);")
w("")
w("-- Always re-resolve the rotation to the two permitted authors, so a settings row")
w("-- created before an author existed repairs itself instead of holding a NULL.")
w("UPDATE blog_title_bank_settings SET author_ids = ARRAY[")
w("    (SELECT id FROM blog_authors WHERE slug='sandeep-kumar-chaudhary' ORDER BY id LIMIT 1),")
w("    (SELECT id FROM blog_authors WHERE slug='tarkaraj-jaisi'          ORDER BY id LIMIT 1)]::INTEGER[],")
w("  updated_at = NOW()")
w(" WHERE account_id = :acct")
w("   AND (SELECT id FROM blog_authors WHERE slug='sandeep-kumar-chaudhary' ORDER BY id LIMIT 1) IS NOT NULL")
w("   AND (SELECT id FROM blog_authors WHERE slug='tarkaraj-jaisi'          ORDER BY id LIMIT 1) IS NOT NULL;")
w("")

for d in D:
    p = d["pillar"]; n = p["n"]
    fly = flyers[n]
    w(f"INSERT INTO blog_pillars (pillar_number,title,slug,description,primary_intent,target_audience,"
      f"seo_note,aeo_note,geo_note,aio_note,primary_keyword,secondary_keywords,subtopics,category_id,flyer_filename,flyer_url) VALUES ("
      f"{n},{q(p['title'])},{q(p['slug'])},{q(p['desc'])},{q(p['intent'])},{q(p['aud'])},"
      f"{q(p['seo'])},{q(p['aeo'])},{q(p['geo'])},{q(p['aio'])},{q(p['kw'])},{arr(p['kw2'])},{arr(p['sub'])},"
      f"{cat_for(n)},{q(fly)},{q('/blog-flyers/' + re.sub(r'[^a-z0-9]+','-',fly[:-4].lower()).strip('-') + '.png')})")
    w("ON CONFLICT (pillar_number) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug, description=EXCLUDED.description,"
      " primary_intent=EXCLUDED.primary_intent, target_audience=EXCLUDED.target_audience, seo_note=EXCLUDED.seo_note,"
      " aeo_note=EXCLUDED.aeo_note, geo_note=EXCLUDED.geo_note, aio_note=EXCLUDED.aio_note,"
      " primary_keyword=EXCLUDED.primary_keyword, secondary_keywords=EXCLUDED.secondary_keywords,"
      " subtopics=EXCLUDED.subtopics, category_id=EXCLUDED.category_id, flyer_filename=EXCLUDED.flyer_filename,"
      " flyer_url=EXCLUDED.flyer_url, updated_at=NOW();")

ARCHL = {"beginner":"Beginner guide","advanced":"Advanced guide","howto":"How-to","tutorial":"Tutorial",
 "ultimate":"Ultimate guide","checklist":"Checklist","template":"Template","examples":"Examples","casestudy":"Case study",
 "strategy":"Strategy","bestpractice":"Best practices","mistakes":"Mistakes","problem":"Problem/solution","faq":"FAQ",
 "comparison":"Comparison","alternatives":"Alternatives","tools":"Tools","pricing":"Pricing","roi":"ROI",
 "stats":"Statistics","trends":"Trends","predictions":"Predictions","benchmarks":"Benchmarks","industry":"Industry",
 "smallbiz":"Small business","enterprise":"Enterprise","local":"Local","b2b":"B2B","b2c":"B2C","ai":"AI-powered"}
w("")
rows = 0
for d in D:
    n = d["pillar"]["n"]
    vals = []
    for t in d["titles"]:
        vals.append(f"((SELECT id FROM blog_pillars WHERE pillar_number={n}),{t['n']},{q(t['title'])},"
                    f"{q(key(t['title']))},{q(ARCHL[t['archetype']])},{q(t['topic'])})")
        rows += 1
    w("INSERT INTO blog_title_bank (pillar_id,title_number,title,title_key,content_type,subject_entity) VALUES")
    w(",\n".join(vals))
    # Never reset a title that has already been through the lifecycle.
    w("ON CONFLICT (pillar_id,title_number) DO UPDATE SET title=EXCLUDED.title, title_key=EXCLUDED.title_key,"
      " content_type=EXCLUDED.content_type, subject_entity=EXCLUDED.subject_entity, updated_at=NOW()")
    w("WHERE blog_title_bank.status = 'available';")
w("")
w("COMMIT;")
open("seed_title_bank.sql","w").write("\n".join(out) + "\n")
print(f"seed rows: {rows} titles, 50 pillars -> seed_title_bank.sql ({os.path.getsize('seed_title_bank.sql')//1024} KB)")
