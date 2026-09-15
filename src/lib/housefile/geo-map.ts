/** Web Mercator helpers for a light OSM/Carto tile map (no extra map library). */

export type GeoPoint = { lat: number; lng: number };

const TILE = 256;

export function worldPx(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * TILE;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n * TILE;
  return { x, y };
}

export function fitMapView(
  points: GeoPoint[],
  width: number,
  height: number,
): { zoom: number; center: GeoPoint } {
  const fallback = { zoom: 11, center: points[0] ?? { lat: 33.95, lng: -84.55 } };
  if (!points.length || width < 40 || height < 40) return fallback;
  if (points.length === 1) return { zoom: 15, center: points[0]! };

  const pad = 56;
  for (let zoom = 15; zoom >= 4; zoom--) {
    const px = points.map((p) => worldPx(p.lat, p.lng, zoom));
    const minX = Math.min(...px.map((p) => p.x));
    const maxX = Math.max(...px.map((p) => p.x));
    const minY = Math.min(...px.map((p) => p.y));
    const maxY = Math.max(...px.map((p) => p.y));
    if (maxX - minX + pad * 2 <= width && maxY - minY + pad * 2 <= height) {
      const mid = worldPxToLngLat((minX + maxX) / 2, (minY + maxY) / 2, zoom);
      return { zoom, center: mid };
    }
  }
  const midLat = (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2;
  const midLng = (Math.min(...points.map((p) => p.lng)) + Math.max(...points.map((p) => p.lng))) / 2;
  return { zoom: 4, center: { lat: midLat, lng: midLng } };
}

export function worldPxToLngLat(x: number, y: number, zoom: number): GeoPoint {
  const n = 2 ** zoom;
  const lng = (x / (n * TILE)) * 360 - 180;
  const m = Math.PI - (2 * Math.PI * y) / (n * TILE);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(m) - Math.exp(-m)));
  return { lat, lng };
}

export function tileUrl(z: number, x: number, y: number) {
  const n = 2 ** z;
  const wrapX = ((x % n) + n) % n;
  return `https://basemaps.cartocdn.com/light_all/${z}/${wrapX}/${y}.png`;
}

export function visibleTiles(
  center: GeoPoint,
  zoom: number,
  width: number,
  height: number,
): { z: number; x: number; y: number; left: number; top: number }[] {
  const origin = worldPx(center.lat, center.lng, zoom);
  const leftPx = origin.x - width / 2;
  const topPx = origin.y - height / 2;
  const x0 = Math.floor(leftPx / TILE);
  const y0 = Math.floor(topPx / TILE);
  const x1 = Math.floor((leftPx + width) / TILE);
  const y1 = Math.floor((topPx + height) / TILE);
  const tiles: { z: number; x: number; y: number; left: number; top: number }[] = [];
  const n = 2 ** zoom;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      tiles.push({
        z: zoom,
        x,
        y,
        left: x * TILE - leftPx,
        top: y * TILE - topPx,
      });
    }
  }
  return tiles;
}

export function pointOnMap(
  point: GeoPoint,
  center: GeoPoint,
  zoom: number,
  width: number,
  height: number,
) {
  const origin = worldPx(center.lat, center.lng, zoom);
  const px = worldPx(point.lat, point.lng, zoom);
  return {
    left: px.x - (origin.x - width / 2),
    top: px.y - (origin.y - height / 2),
  };
}
