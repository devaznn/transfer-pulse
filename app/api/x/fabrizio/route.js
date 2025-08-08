export async function GET() {
  const BEARER = process.env.TWITTER_BEARER_TOKEN;
  if (!BEARER) return new Response(JSON.stringify({ error: "Missing token" }), { status: 500 });

  const u = await fetch("https://api.x.com/2/users/by/username/FabrizioRomano", {
    headers: { Authorization: `Bearer ${BEARER}` },
    cache: "no-store",
  });
  if (!u.ok) return new Response(JSON.stringify({ error: "User lookup failed" }), { status: 502 });
  const uj = await u.json();
  const uid = uj?.data?.id;

  const url = `https://api.x.com/2/users/${uid}/tweets?max_results=20&tweet.fields=created_at,entities&expansions=attachments.media_keys&media.fields=url,preview_image_url`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` }, cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text();
    return new Response(JSON.stringify({ error: "X API failed", detail: txt }), { status: 502 });
  }
  const j = await r.json();
  const mediaMap = new Map((j.includes?.media || []).map(m => [m.media_key, m]));
  const items = (j.data || []).map(t => {
    const key = t.attachments?.media_keys?.[0];
    const media = key ? mediaMap.get(key) : null;
    return {
      id: t.id,
      text: t.text,
      title: t.text.length > 100 ? t.text.slice(0, 100) + "…" : t.text,
      link: `https://x.com/FabrizioRomano/status/${t.id}`,
      created_at: t.created_at,
      image: media?.url || media?.preview_image_url || "",
    };
  });
  return Response.json({ items });
}
