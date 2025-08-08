export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });

  const upstream = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const r = await fetch(upstream, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text();
    return new Response(JSON.stringify({ error: "Upstream failed", detail: txt }), { status: 502 });
  }
  const data = await r.text();
  return new Response(data, { status: 200, headers: { "Content-Type": "application/json" } });
}
