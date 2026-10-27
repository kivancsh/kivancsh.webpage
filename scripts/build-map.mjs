// Pre-projects the world map once, so the travel page only loads a small JSON of SVG
// paths instead of a geo library. Run with: npm run map
// Europe and its neighbours use the 50m Natural Earth data (simplified), the rest of the
// world the coarse 110m set: the map only ever zooms into Europe, so detail elsewhere is
// never seen. Keeps the file around 100 KB.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import { geoNaturalEarth1, geoPath, geoCentroid, geoArea } from 'd3-geo';

const require = createRequire(import.meta.url);
// keep the most significant 20% of the 50m points (Visvalingam): the rest is invisible at this scale
const raw50 = presimplify(require('world-atlas/countries-50m.json'));
const t50 = simplify(raw50, quantile(raw50, Number(process.env.MAP_Q || 0.2)));
const t110 = require('world-atlas/countries-110m.json');

const W = 1000;
const H = 520;
const projection = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });

const inDetailZone = (f) => {
  const [lon, lat] = geoCentroid(f);
  return lon > -25 && lon < 50 && lat > 30 && lat < 72;
};

const detailed = feature(t50, t50.objects.countries).features.filter(inDetailZone);
const names = new Set(detailed.map((f) => f.properties.name));
const coarse = feature(t110, t110.objects.countries).features.filter((f) => !names.has(f.properties.name) && f.properties.name !== 'Antarctica');

const pathFine = geoPath(projection).digits(1);
const pathCoarse = geoPath(projection).digits(0);

// biggest polygon of a country (Norway without Svalbard, etc.) for flag placement
function mainland(f) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  let best = null;
  let area = -1;
  for (const coords of f.geometry.coordinates) {
    const g = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } };
    const a = geoArea(g);
    if (a > area) { area = a; best = g; }
  }
  return best;
}

const round = (v) => Math.round(v * 100) / 100;
const countries = [...detailed.map((f) => [f, pathFine]), ...coarse.map((f) => [f, pathCoarse])]
  .map(([f, path]) => {
    const m = mainland(f);
    const [[x0, y0], [x1, y1]] = path.bounds(m);
    const [cx, cy] = path.centroid(m);
    return { n: f.properties.name, d: path(f), b: [x0, y0, x1, y1].map(round), c: [round(cx), round(cy)] };
  })
  .filter((c) => c.d);

const graticule = geoPath(projection).digits(1)({ type: 'Sphere' });
const out = { w: W, h: H, sphere: graticule, countries };
fs.mkdirSync('public/content/map', { recursive: true });
fs.writeFileSync('public/content/map/world.json', JSON.stringify(out));
console.log(`${countries.length} countries, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
