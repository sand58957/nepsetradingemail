payload = open("payload.json").read()
HTML = r"""<title>Topical Map 5000</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{
  --paper:#FBFAFD; --surface:#FFFFFF; --sunk:#F3F1F8;
  --ink:#12121C; --ink-2:#3A3850; --grey:#6E6B8A; --faint:#9A97B0;
  --line:#E4E1EE; --line-2:#D2CEE4;
  --accent:#7367F0; --accent-deep:#5A4FD1; --accent-wash:#EFEDFE;
  --good:#1F9D6B; --warn:#B8791F;
  --f-display:"Bricolage Grotesque",Georgia,serif;
  --f-body:"Public Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --f-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --rail:288px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0D0D16; --surface:#15141F; --sunk:#1B1A28;
  --ink:#EDEBF5; --ink-2:#C3BFD6; --grey:#9793AE; --faint:#6E6A85;
  --line:#272536; --line-2:#332F47;
  --accent:#9A8FFF; --accent-deep:#B5ACFF; --accent-wash:#211E36;
  --good:#3FBE8A; --warn:#D99A3C;
}}
:root[data-theme="dark"]{
  --paper:#0D0D16; --surface:#15141F; --sunk:#1B1A28;
  --ink:#EDEBF5; --ink-2:#C3BFD6; --grey:#9793AE; --faint:#6E6A85;
  --line:#272536; --line-2:#332F47;
  --accent:#9A8FFF; --accent-deep:#B5ACFF; --accent-wash:#211E36;
  --good:#3FBE8A; --warn:#D99A3C;
}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--f-display);text-wrap:balance;margin:0}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

.masthead{border-bottom:1px solid var(--line);background:var(--surface)}
.masthead-in{max-width:1400px;margin:0 auto;padding:22px 28px 0}
.eyebrow{font-family:var(--f-mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);font-weight:600}
h1{font-size:31px;font-weight:700;letter-spacing:-.022em;margin:7px 0 3px}
.sub{color:var(--grey);max-width:65ch;font-size:14.5px}
.tally{display:flex;gap:26px;flex-wrap:wrap;margin:18px 0 0;padding:0;list-style:none}
.tally li{display:flex;flex-direction:column;gap:1px}
.tally b{font-family:var(--f-mono);font-size:19px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tally span{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}
.ck{color:var(--good)}

.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:16px 0 14px;border-top:1px solid var(--line);margin-top:18px}
.search{flex:1;min-width:260px;position:relative}
.search input{width:100%;padding:9px 13px 9px 34px;border:1px solid var(--line-2);border-radius:7px;background:var(--sunk);color:var(--ink);font-size:14px;font-family:var(--f-body)}
.search input::placeholder{color:var(--faint)}
.search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--faint)}
select{padding:9px 11px;border:1px solid var(--line-2);border-radius:7px;background:var(--sunk);color:var(--ink);font-size:13.5px}
.hits{font-family:var(--f-mono);font-size:12.5px;color:var(--grey);font-variant-numeric:tabular-nums;white-space:nowrap}

.shell{max-width:1400px;margin:0 auto;padding:22px 28px 72px;display:grid;grid-template-columns:var(--rail) minmax(0,1fr);gap:28px;align-items:start}
@media (max-width:1000px){.shell{grid-template-columns:1fr;gap:20px}.rail{max-height:none}}

.rail{position:sticky;top:16px;max-height:calc(100vh - 40px);overflow-y:auto;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.grp{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);padding:13px 14px 5px;position:sticky;top:0;background:var(--surface)}
.prow{display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:baseline;width:100%;text-align:left;background:none;border:0;border-left:2px solid transparent;padding:7px 14px;cursor:pointer;font-size:13.4px;line-height:1.35;color:var(--ink-2)}
.prow:hover{background:var(--sunk);color:var(--ink)}
.prow[aria-current="true"]{background:var(--accent-wash);border-left-color:var(--accent);color:var(--ink);font-weight:600}
.pnum{font-family:var(--f-mono);font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums}
.prow[aria-current="true"] .pnum{color:var(--accent)}
.pct{font-family:var(--f-mono);font-size:10.5px;color:var(--faint);font-variant-numeric:tabular-nums}

.panel{border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
.phead{padding:22px 26px 20px;border-bottom:1px solid var(--line)}
.phead h2{font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:5px}
.slug{font-family:var(--f-mono);font-size:12px;color:var(--accent);background:var(--accent-wash);padding:2px 7px;border-radius:4px;display:inline-block;margin-bottom:11px}
.pdesc{color:var(--ink-2);max-width:70ch;font-size:14.5px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(228px,1fr));gap:16px 26px;margin-top:20px}
.mrow dt{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:3px}
.mrow dd{margin:0;font-size:13.6px;color:var(--ink-2);line-height:1.5}
.subs{display:flex;flex-wrap:wrap;gap:5px;margin-top:16px;padding:0;list-style:none}
.subs li{font-size:12.3px;color:var(--ink-2);background:var(--sunk);border:1px solid var(--line);padding:2px 9px;border-radius:20px}

.tbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 26px;background:var(--sunk);border-bottom:1px solid var(--line);flex-wrap:wrap}
.tbar h3{font-size:13px;font-weight:600;letter-spacing:.02em}
.copy{border:1px solid var(--line-2);background:var(--surface);border-radius:6px;padding:5px 11px;font-size:12.5px;cursor:pointer;color:var(--ink-2)}
.copy:hover{border-color:var(--accent);color:var(--accent)}
ol.titles{list-style:none;margin:0;padding:0}
ol.titles li{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:baseline;padding:8px 26px;border-bottom:1px solid var(--line)}
ol.titles li:last-child{border-bottom:0}
ol.titles li:hover{background:var(--sunk)}
.tn{font-family:var(--f-mono);font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.tt{font-size:14.6px;line-height:1.45;color:var(--ink)}
.chip{font-family:var(--f-mono);font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);border:1px solid var(--line-2);border-radius:20px;padding:2px 8px;white-space:nowrap}
mark{background:var(--accent-wash);color:var(--accent-deep);padding:0 2px;border-radius:2px;font-weight:600}
.empty{padding:52px 26px;text-align:center;color:var(--grey)}
.pill-ref{font-family:var(--f-mono);font-size:10.5px;color:var(--accent);white-space:nowrap}
.foot{max-width:1400px;margin:0 auto;padding:0 28px 40px;color:var(--faint);font-size:12.5px}
</style>

<header class="masthead">
  <div class="masthead-in">
    <div class="eyebrow">Content architecture · SEO / AEO / GEO / AIO</div>
    <h1>Topical Map 5000</h1>
    <p class="sub">Fifty content pillars and five thousand publish-ready blog titles, mapped to the Email, WhatsApp, SMS, Telegram, Messenger and Blog CMS channels. Every title is checked for exact and near-duplicate collisions before it enters the set.</p>
    <ul class="tally">
      <li><b>50</b><span>Pillars</span></li>
      <li><b>5,000</b><span>Titles</span></li>
      <li><b>100</b><span>Per pillar</span></li>
      <li><b>30</b><span>Content types</span></li>
      <li><b class="ck">0</b><span>Duplicates</span></li>
      <li><b class="ck">0</b><span>Near-duplicates</span></li>
    </ul>
    <div class="controls">
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
        <input id="q" type="search" placeholder="Search all 5,000 titles — try &quot;deliverability&quot;, &quot;pricing&quot;, &quot;AI agents&quot;" autocomplete="off">
      </div>
      <select id="ftype"><option value="">All content types</option></select>
      <span class="hits" id="hits"></span>
    </div>
  </div>
</header>

<main class="shell">
  <nav class="rail" id="rail" aria-label="Content pillars"></nav>
  <section class="panel" id="panel"></section>
</main>
<p class="foot">Slugs are suggestions for a parent-child URL structure: the pillar sits at its own slug, cluster posts nest beneath it.</p>

<script id="data" type="application/json">__PAYLOAD__</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('data').textContent);
  var P = D.pillars, ARCH = D.arch;
  var rail = document.getElementById('rail'), panel = document.getElementById('panel');
  var q = document.getElementById('q'), ftype = document.getElementById('ftype'), hits = document.getElementById('hits');
  var cur = P[0].n;

  ARCH.slice().map(function(a,i){return [a,i];}).sort(function(a,b){return a[0].localeCompare(b[0]);})
    .forEach(function(p){ var o=document.createElement('option'); o.value=p[1]; o.textContent=p[0]; ftype.appendChild(o); });

  function esc(s){ return s.replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function hl(s, t){
    if(!t) return esc(s);
    var i = s.toLowerCase().indexOf(t); if(i<0) return esc(s);
    return esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+t.length))+'</mark>'+esc(s.slice(i+t.length));
  }
  function term(){ return q.value.trim().toLowerCase(); }
  function typeF(){ return ftype.value === '' ? -1 : +ftype.value; }

  function matches(it){
    var t = term(), ty = typeF();
    if(ty >= 0 && it[1] !== ty) return false;
    return !t || it[0].toLowerCase().indexOf(t) >= 0;
  }
  function countFor(p){ var n=0; for(var i=0;i<p.items.length;i++) if(matches(p.items[i])) n++; return n; }

  function buildRail(){
    var t = term(), ty = typeF(), html = '', seen = {};
    P.forEach(function(p){
      if(!seen[p.g]){ seen[p.g]=1; html += '<div class="grp">'+esc(p.g)+'</div>'; }
      var c = (t||ty>=0) ? countFor(p) : 100;
      html += '<button class="prow" data-n="'+p.n+'" aria-current="'+(p.n===cur)+'">'
           +  '<span class="pnum">'+String(p.n).padStart(2,'0')+'</span>'
           +  '<span>'+esc(p.t)+'</span><span class="pct">'+c+'</span></button>';
    });
    rail.innerHTML = html;
  }

  function render(){
    var p = null; for(var i=0;i<P.length;i++) if(P[i].n===cur) p=P[i];
    var t = term(), ty = typeF();
    var list = [];
    p.items.forEach(function(it, idx){ if(matches(it)) list.push([idx+1, it]); });

    var total = 0; P.forEach(function(x){ total += countFor(x); });
    hits.textContent = (t||ty>=0) ? total.toLocaleString()+' of 5,000 match' : '5,000 titles';

    var meta = [['Primary intent',p.i],['Target audience',p.a],['Primary keyword theme',p.kw],
                ['Secondary themes',p.kw2.join(' · ')],['SEO',p.seo],['AEO',p.aeo],['GEO',p.geo],['AIO',p.aio]];
    var h = '<div class="phead"><h2>'+esc(p.t)+'</h2>'
          + '<span class="slug">/'+esc(p.s)+'/</span>'
          + '<p class="pdesc">'+esc(p.d)+'</p><dl class="meta">';
    meta.forEach(function(m){ h += '<div class="mrow"><dt>'+m[0]+'</dt><dd>'+esc(m[1])+'</dd></div>'; });
    h += '</dl><ul class="subs">'+p.sub.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul></div>';

    h += '<div class="tbar"><h3>'+(list.length===100?'All 100 titles':list.length+' matching title'+(list.length===1?'':'s'))
       +  '</h3><button class="copy" id="copyall">Copy '+(list.length===100?'all 100':'these '+list.length)+'</button></div>';

    if(!list.length){
      h += '<p class="empty">No titles in this pillar match that filter. Other pillars may still have matches — the counts in the left rail show where.</p>';
    } else {
      h += '<ol class="titles">';
      list.forEach(function(r){
        h += '<li><span class="tn">'+String(r[0]).padStart(3,'0')+'</span>'
          +  '<span class="tt">'+hl(r[1][0], t)+'</span>'
          +  '<span class="chip">'+esc(ARCH[r[1][1]])+'</span></li>';
      });
      h += '</ol>';
    }
    panel.innerHTML = h;
    var btn = document.getElementById('copyall');
    if(btn) btn.addEventListener('click', function(){
      var txt = list.map(function(r){ return r[1][0]; }).join('\n');
      navigator.clipboard.writeText(txt).then(function(){
        btn.textContent = 'Copied '+list.length;
        setTimeout(function(){ btn.textContent = 'Copy '+(list.length===100?'all 100':'these '+list.length); }, 1600);
      }, function(){ btn.textContent = 'Copy failed'; });
    });
  }

  rail.addEventListener('click', function(e){
    var b = e.target.closest('.prow'); if(!b) return;
    cur = +b.dataset.n; buildRail(); render();
    if(window.innerWidth <= 1000) panel.scrollIntoView({behavior:'smooth', block:'start'});
  });
  var deb; function onFilter(){ clearTimeout(deb); deb = setTimeout(function(){ buildRail(); render(); }, 110); }
  q.addEventListener('input', onFilter);
  ftype.addEventListener('change', function(){ buildRail(); render(); });

  buildRail(); render();
})();
</script>
"""
open("topical-map.html","w").write(HTML.replace("__PAYLOAD__", payload))
print("wrote topical-map.html", len(open("topical-map.html").read()), "bytes")
