
/**
 * IANTEL briefing builder (runs in GitHub Actions).
 * Fetches RSS/JSON server-side (no browser CORS), writes data/briefing.json.
 */
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import fetch from "node-fetch";

const parser = new Parser({ timeout: 15000 });
const OUT = path.join(process.cwd(), "data", "briefing.json");

function nowISO(){ return new Date().toISOString(); }

function cleanText(s=""){
  return String(s)
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryRSS(url){
  try{
    const feed = await parser.parseURL(url);
    return (feed.items || []).map(it => ({
      title: cleanText(it.title || ""),
      url: it.link || "",
      published: it.isoDate ? it.isoDate.slice(0,10) : "",
      description: cleanText(it.contentSnippet || it.content || it.summary || "").slice(0, 180)
    })).filter(x => x.title && x.url);
  }catch(e){
    return [];
  }
}

async function tryJSON(url, mapFn){
  try{
    const res = await fetch(url, { headers: { "user-agent":"iantel-bot" }});
    if(!res.ok) return [];
    const j = await res.json();
    return mapFn(j) || [];
  }catch(e){
    return [];
  }
}

function pickN(items, n){
  const out = [];
  const seen = new Set();
  for(const it of items){
    const k = it.url || it.title;
    if(!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
    if(out.length >= n) break;
  }
  return out;
}

async function buildSection(name, sources, n=3){
  let all = [];
  for(const src of sources){
    const items = src.type === "rss" ? await tryRSS(src.url) : await tryJSON(src.url, src.map);
    all = all.concat(items.map(it => ({...it, source: src.source || src.name || src.url})));
  }
  return pickN(all, n);
}

async function cryptoSnapshot(){
  // CoinGecko (no key) – returns USD prices and market caps
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&sparkline=false&price_change_percentage=24h";
  const items = await tryJSON(url, (arr) => (arr||[]).slice(0,8).map(x => ({
    symbol: String(x.symbol||"").toUpperCase(),
    priceUsd: x.current_price,
    change24h: x.price_change_percentage_24h || x.price_change_percentage_24h_in_currency || 0,
    mcapUsd: x.market_cap
  })));
  return {
    updated_local: new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
    items
  };
}

function messages(){
  const family = [
    "For your eyes only: keep it calm, keep it sharp. Love your family ♥",
    "Good intelligence is slow. Your day can be too. Love your family ♥",
    "Pick one thing and enjoy it. The rest can wait. Love your family ♥",
    "No rushing. You’ve earned a quiet win. Love your family ♥"
  ];
  const son = [
    "No rushing. No proving. Just a good day. — love, your son",
    "One headline. One full read. That’s the win. — love, your son",
    "Curiosity first. Certainty later. — love, your son",
    "If it’s interesting, it’s worth your time. — love, your son"
  ];
  return { family, son };
}

async function main(){
  // Strong, RSS-first sources that typically allow server fetch.
  const sections = {};

  sections.crypto = await buildSection("crypto", [
    { type:"rss", url:"https://www.coindesk.com/arc/outboundfeeds/rss/", source:"CoinDesk" },
    { type:"rss", url:"https://decrypt.co/feed", source:"Decrypt" },
    { type:"rss", url:"https://cointelegraph.com/rss", source:"Cointelegraph" }
  ], 3);

  sections.markets = await buildSection("markets", [
    { type:"rss", url:"https://www.federalreserve.gov/feeds/press_all.xml", source:"Federal Reserve (press)" },
    { type:"rss", url:"https://www.imf.org/en/News/RSS?language=eng", source:"IMF News" },
    { type:"rss", url:"https://www.bis.org/rss/press.xml", source:"BIS (press)" }
  ], 3);

  sections.built = await buildSection("built", [
    { type:"rss", url:"https://www.dezeen.com/feed/", source:"Dezeen" },
    { type:"rss", url:"https://www.archdaily.com/rss", source:"ArchDaily" },
    { type:"rss", url:"https://www.infrastructuremagazine.com.au/feed/", source:"Infrastructure Magazine (AU)" }
  ], 3);

  // Reading intel — 1 per genre, but keep it fresh:
  const reading = await buildSection("reading", [
    { type:"rss", url:"https://www.theguardian.com/books/rss", source:"The Guardian (Books)" },
    { type:"rss", url:"https://lithub.com/feed/", source:"Literary Hub" },
    { type:"rss", url:"https://www.npr.org/rss/rss.php?id=1032", source:"NPR Books" }
  ], 8);

  // We'll label genre heuristically from title keywords; then pick one per genre bucket.
  const buckets = {
    "history": [],
    "biography": [],
    "business": [],
    "fiction": [],
    "science": []
  };
  for(const it of reading){
    const t = (it.title||"").toLowerCase();
    if(t.match(/history|war|empire|ancient|after/)) buckets.history.push(it);
    else if(t.match(/biograph|memoir|life of|diary/)) buckets.biography.push(it);
    else if(t.match(/invest|market|business|econom|money/)) buckets.business.push(it);
    else if(t.match(/novel|fiction|story/)) buckets.fiction.push(it);
    else buckets.science.push(it);
  }
  sections.reading = Object.entries(buckets).flatMap(([genre, arr]) => {
    const one = pickN(arr, 1).map(x => ({...x, source: x.source + ` · ${genre}`}));
    return one;
  }).slice(0,5);

  sections.garden = await buildSection("garden", [
    { type:"rss", url:"https://www.abc.net.au/news/feed/51120/rss.xml", source:"ABC (Lifestyle/Gardening)" },
    { type:"rss", url:"https://www.gardenclinic.com/feed/", source:"The Garden Clinic" },
    { type:"rss", url:"https://www.rhs.org.uk/rss", source:"RHS" }
  ], 3);

  sections.ears = await buildSection("ears", [
    { type:"rss", url:"https://pitchfork.com/rss/news/", source:"Pitchfork (News)" },
    { type:"rss", url:"https://www.nme.com/news/music/feed", source:"NME (Music News)" },
    { type:"rss", url:"https://www.theguardian.com/music/rss", source:"The Guardian (Music)" }
  ], 3);

  const out = {
    meta: { generated_at: nowISO(), edition: Math.floor(Date.now()/1000) },
    messages: messages(),
    snapshot: await cryptoSnapshot(),
    sections
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log("Wrote", OUT);
}

main();
