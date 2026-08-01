// One-shot loader: administrative boundary GeoJSON → hitrace.regions (PostGIS).
//
// Source datasets live outside this repo (they are ~2.5MB and change once every few years):
//   korea.geojson     3,482 행정동  { code, name }
//   sigungu.geojson     230 시군구  { properties keyed by code }
//
// Usage:
//   node tools/seed-regions.mjs <geojson-dir>
//
// Idempotent: rows are upserted by code, so re-running after a boundary revision is safe.
// Sends geometry as GeoJSON text and lets PostGIS parse it — no WKT string building, so a
// polygon with holes or a multipolygon survives the trip intact.

import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? 'hfxtzevtnldsmbgcnwoa';
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is required');
  process.exit(1);
}

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/seed-regions.mjs <geojson-dir>');
  process.exit(1);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'hitrace-seed-regions/1.0',
    },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** MultiPolygon everywhere: a single geometry type keeps the column and the queries simple. */
function toMultiPolygon(geometry) {
  if (geometry.type === 'MultiPolygon') return geometry;
  if (geometry.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
  return null;
}

function load(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  return raw.features ?? [];
}

/**
 * The two datasets label their features differently, so each gets its own reader rather than a
 * clever generic one that silently picks the wrong property.
 */
function readDong(feature) {
  // { code: '1114066', name: '서교동' } — the first four digits are the 시군구 key.
  const p = feature.properties ?? {};
  const code = p.code ?? p.adm_cd ?? p.ADM_CD;
  const name = p.name ?? p.adm_nm ?? p.ADM_NM;
  return code && name ? { code: String(code), name: String(name), sido: null } : null;
}

function readGu(feature) {
  // { key: '1101', sido: '서울특별시', sigungu: '종로구' }
  // Name is the 시군구, never the 시도 — and the 시도 is kept because 중구/동구 exist in several
  // cities at once, so a ranking that only says "중구" is ambiguous.
  const p = feature.properties ?? {};
  const code = p.key ?? p.code ?? p.SIG_CD ?? p.sig_cd;
  const name = p.sigungu ?? p.name ?? p.SIG_KOR_NM;
  if (!code || !name) return null;
  return { code: String(code), name: String(name), sido: p.sido ? String(p.sido) : null };
}

/**
 * A 행정동 code starts with its 시군구 code, so the hierarchy comes free — no spatial join,
 * no ambiguity on boundaries.
 */
function parentOf(dongCode, guCodes) {
  for (let len = 5; len >= 4; len--) {
    const prefix = dongCode.slice(0, len);
    if (guCodes.has(prefix)) return prefix;
  }
  return null;
}

async function upsert(rows) {
  // Batched: one statement per row would be 3,700 round trips.
  const BATCH = 40;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk
      .map((r) => {
        const geom = `st_multi(st_setsrid(st_geomfromgeojson(${quote(JSON.stringify(r.geometry))}), 4326))`;
        return `(${quote(r.code)}, ${quote(r.name)}, ${r.sido ? quote(r.sido) : 'null'}, ${quote(r.level)}, ${r.parent ? quote(r.parent) : 'null'}, ${geom}, st_centroid(${geom}))`;
      })
      .join(',\n');
    await sql(`
      insert into hitrace.regions (code, name, sido, level, parent_code, geom, centroid)
      values ${values}
      on conflict (code) do update
        set name = excluded.name,
            sido = coalesce(excluded.sido, hitrace.regions.sido),
            level = excluded.level,
            parent_code = excluded.parent_code,
            geom = excluded.geom,
            centroid = excluded.centroid,
            retired_at = null;
    `);
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${rows.length}`);
  }
  process.stdout.write('\n');
}

// ── gu first: the dong rows reference them ───────────────────────────────────
const guFeatures = load('sigungu.geojson');
const guRows = [];
for (const f of guFeatures) {
  const meta = readGu(f);
  const geometry = toMultiPolygon(f.geometry);
  if (meta && geometry) guRows.push({ ...meta, level: 'gu', parent: null, geometry });
  // 시군구 codes are the first four digits of every 행정동 code beneath them.
}
console.log(`시군구 ${guRows.length}개`);
await upsert(guRows);

const guCodes = new Set(guRows.map((r) => r.code));

const dongFeatures = load('korea.geojson');
const dongRows = [];
let orphans = 0;
for (const f of dongFeatures) {
  const meta = readDong(f);
  const geometry = toMultiPolygon(f.geometry);
  if (!meta || !geometry) continue;
  const parent = parentOf(meta.code, guCodes);
  if (!parent) orphans++;
  dongRows.push({ ...meta, level: 'dong', parent, geometry });
}
console.log(`행정동 ${dongRows.length}개 (상위 구 못 찾음: ${orphans})`);
await upsert(dongRows);

const [counts] = await sql(`
  select
    count(*) filter (where level = 'gu')   as gu,
    count(*) filter (where level = 'dong') as dong,
    count(*) filter (where level = 'dong' and parent_code is null) as dong_orphan
  from hitrace.regions;
`);
console.log('적재 완료:', counts);
