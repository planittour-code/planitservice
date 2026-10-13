import { createFileRoute } from "@tanstack/react-router";

function intParam(url: URL, name: string) {
  const raw = url.searchParams.get(name);
  if (raw == null || !/^-?\d+$/.test(raw)) return null;
  return Number(raw);
}

export const Route = createFileRoute("/api/map-tile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const z = intParam(url, "z");
        const x = intParam(url, "x");
        const y = intParam(url, "y");
        if (z == null || x == null || y == null || z < 0 || z > 20 || y < 0 || y >= 2 ** z) {
          return new Response("Bad tile", { status: 400 });
        }
        const key = process.env.CARTO_API_KEY?.trim();
        if (!key) return new Response("Map key missing", { status: 503 });
        const n = 2 ** z;
        const wrapX = ((x % n) + n) % n;
        const upstream =
          `https://basemaps.cartocdn.com/light_all/${z}/${wrapX}/${y}.png` +
          `?key=${encodeURIComponent(key)}`;
        const referer = request.headers.get("referer") || "https://planitservice.com/";
        try {
          const res = await fetch(upstream, {
            headers: {
              Accept: "image/png,image/*",
              Referer: referer,
              "User-Agent": "PlanitService/1.0",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return new Response("Tile unavailable", { status: 502 });
          return new Response(await res.arrayBuffer(), {
            headers: {
              "Content-Type": res.headers.get("content-type") || "image/png",
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("Tile unavailable", { status: 502 });
        }
      },
    },
  },
});
