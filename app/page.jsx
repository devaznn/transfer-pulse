"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const SOURCES = [
  {
    id: "bbc-football",
    name: "BBC Sport Football",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    homepage: "https://www.bbc.com/sport/football",
    reliability: "High",
  },
  {
    id: "sky-sports-transfers",
    name: "Sky Sports Transfer Centre",
    url: "https://www.skysports.com/rss/12040",
    homepage: "https://www.skysports.com/transfer-centre",
    reliability: "High",
  },
  {
    id: "guardian-football",
    name: "The Guardian Football",
    url: "https://www.theguardian.com/football/rss",
    homepage: "https://www.theguardian.com/football",
    reliability: "High",
  },
  {
    id: "espn-soccer",
    name: "ESPN FC",
    url: "https://www.espn.com/espn/rss/soccer/news",
    homepage: "https://www.espn.com/soccer/",
    reliability: "High",
  },
  {
    id: "fabrizio-x",
    name: "Fabrizio Romano on X",
    type: "x-user",
    username: "FabrizioRomano",
    endpoint: "/api/x/fabrizio",
    homepage: "https://x.com/FabrizioRomano",
    reliability: "High",
  },
];

const RSS2JSON = (rssUrl) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.max(0, now.getTime() - then.getTime());
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

function classifyItem(title = "", desc = "") {
  const t = `${title} ${desc}`.toLowerCase();
  const official = /(signs|completes|confirmed|announces|official|joins|permanent deal|transfer complete)/i.test(t);
  const rumor = /(linked with|interest in|monitoring|target|rumour|rumor|talks|close to)/i.test(t);
  const loan = /(loan|season-long loan|loan deal)/i.test(t);
  const outgoing = /(departs|leaves|exit|sold|released)/i.test(t);
  let label = "News";
  if (official) label = "Official";
  else if (loan) label = "Loan";
  else if (outgoing) label = "Departure";
  else if (rumor) label = "Rumor";
  return label;
}

function faviconFrom(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export default function Page() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [onlyOfficial, setOnlyOfficial] = useState(false);
  const [activeSources, setActiveSources] = useState(() => new Set(SOURCES.map((s) => s.id)));
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    refresh();
    const t = setInterval(refresh, 240000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const payloads = await Promise.all(
        SOURCES.filter((s) => activeSources.has(s.id)).map(fetchSource)
      );
      const merged = payloads.flat();
      const seen = new Set();
      const dedup = [];
      for (const it of merged) {
        try {
          const host = new URL(it.link).hostname;
          const key = `${it.title}|${host}`;
          if (seen.has(key)) continue;
          seen.add(key);
          dedup.push(it);
        } catch {
          dedup.push(it);
        }
      }
      dedup.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      setItems(dedup);
    } catch (e) {
      setError("Could not load feeds right now. Check the API route and your token.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSource(src) {
    if (src.type === "x-user") {
      const res = await fetch(src.endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`${src.name} fetch failed`);
      const data = await res.json();
      return (data.items || []).map((tw) => ({
        id: `${src.id}-${tw.id}`,
        sourceId: src.id,
        sourceName: src.name,
        sourceHomepage: src.homepage,
        sourceReliability: src.reliability,
        title: tw.title || tw.text || "Tweet",
        link: tw.link,
        pubDate: tw.created_at,
        description: tw.summary || "",
        thumbnail: tw.image || "",
        label: classifyItem(tw.title || tw.text || ""),
      }));
    }
    const res = await fetch(RSS2JSON(src.url), { cache: "no-store" });
    if (!res.ok) throw new Error(`${src.name} fetch failed`);
    const data = await res.json();
    const mapped = (data.items || []).map((it) => ({
      id: `${src.id}-${it.guid || it.link}`,
      sourceId: src.id,
      sourceName: src.name,
      sourceHomepage: src.homepage,
      sourceReliability: src.reliability,
      title: it.title,
      link: it.link,
      pubDate: it.pubDate || it.pubdate || it.date || new Date().toISOString(),
      description: it.description || "",
      thumbnail: it.thumbnail || it.enclosure?.link || "",
      label: classifyItem(it.title, it.description),
    }));
    return mapped;
  }

  function toggleSource(id) {
    const next = new Set(activeSources);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActiveSources(next);
  }

  const visible = useMemo(() => {
    return items.filter((it) => {
      if (onlyOfficial && it.label !== "Official" && it.label !== "Loan") return false;
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        const hay = `${it.title} ${it.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, onlyOfficial]);

  const countsByLabel = useMemo(() => {
    const map = new Map();
    for (const it of items) map.set(it.label, (map.get(it.label) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70 border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800">⚽</span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Transfer Pulse</h1>
              <p className="text-xs text-neutral-400">Latest football transfers from trusted sources</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={refresh} className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 active:scale-[.98]">Refresh</button>
            <div className="relative">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player, club, league" className="w-64 rounded-xl bg-neutral-900 px-3 py-2 text-sm outline-none ring-1 ring-neutral-800 focus:ring-neutral-600" />
            </div>
            <label className="inline-flex select-none items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyOfficial} onChange={(e) => setOnlyOfficial(e.target.checked)} className="size-4 accent-white" />
              Only official
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Sources</h2>
            <ul className="space-y-2">
              {SOURCES.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img alt={s.name} className="size-5 rounded-sm" src={faviconFrom(s.homepage)} onError={(e) => (e.currentTarget.style.display = "none")} />
                    <a href={s.homepage} target="_blank" rel="noreferrer" className="truncate text-sm hover:underline">{s.name}</a>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-neutral-400">
                    <input type="checkbox" className="size-4 accent-white" checked={activeSources.has(s.id)} onChange={() => toggleSource(s.id)} />
                    {s.reliability}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Breakdown</h2>
            <ul className="grid grid-cols-2 gap-2">
              {countsByLabel.map(([label, count]) => (
                <li key={label} className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm flex items-center justify-between">
                  <span>{label}</span>
                  <span className="text-neutral-400">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="lg:col-span-3">
          {loading && (
            <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">Loading latest stories. One moment.</div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</div>
          )}
          {visible.length === 0 && !loading ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-10 text-center text-neutral-400">No results right now. Try turning off filters or search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((it) => (
                <article key={it.id} className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 transition">
                  {it.thumbnail ? (
                    <a href={it.link} target="_blank" rel="noreferrer">
                      <img src={it.thumbnail} alt="thumb" className="h-40 w-full object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <div className="h-2 bg-neutral-800" />)
                  }
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5">{it.label}</span>
                      <a href={it.sourceHomepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-200">
                        <img alt={it.sourceName} className="size-4 rounded-sm" src={faviconFrom(it.sourceHomepage)} onError={(e) => (e.currentTarget.style.display = "none")} />
                        <span className="truncate max-w-[10rem]">{it.sourceName}</span>
                      </a>
                      <span className="text-neutral-600">•</span>
                      <time className="text-neutral-400">{timeAgo(it.pubDate)}</time>
                    </div>
                    <a href={it.link} target="_blank" rel="noreferrer" className="block text-base font-medium leading-snug hover:underline">{it.title}</a>
                    {it.description && (
                      <p className="line-clamp-3 text-sm text-neutral-300" dangerouslySetInnerHTML={{ __html: it.description }} />
                    )}
                    <div className="pt-2 flex items-center gap-2">
                      <a href={it.link} target="_blank" rel="noreferrer" className="text-xs text-neutral-300 underline underline-offset-4 hover:text-white">Read more</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-10 text-center text-xs text-neutral-500">Built for demo use. Sources, BBC. Sky Sports. The Guardian. ESPN. Fabrizio Romano on X.</footer>
    </div>
  );
}
