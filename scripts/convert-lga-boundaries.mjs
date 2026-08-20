/**
 * One-time script: build public/geo/nigeria-lgas.geojson for the 12 primary
 * (physically-visited) states, from OCHA's COD-AB Nigeria administrative
 * boundaries (ADM2 = LGA), the GRID3-sourced dataset — the same provenance as
 * `public/geo/nigeria-states.geojson`'s ADM1 layer, so naming conventions and
 * CRS (WGS84 lon/lat) match and the two layers share one projection.
 *
 * Source: https://data.humdata.org/dataset/cod-ab-nga (nga_admin_boundaries.geojson.zip)
 * The raw ADM2 layer (774 LGAs, all of Nigeria) sits at
 * scripts/source-data/nga_admin2.geojson; only the 12 primary states are
 * needed at launch (guide §14), so this script filters down to ~305 features.
 *
 * Every one of the 305 LGA ids in public/data/lgas.json has an exact
 * counterpart in GRID3's ADM2 layer once minor spelling variants are
 * reconciled (verified: every primary state's LGA count matches GRID3's count
 * exactly). The 16 variants below were found by normalized-name diffing.
 *
 * That match is also what settled the old 305-vs-205 count question: the export
 * was never inflated — GRID3 puts exactly 305 LGAs in these 12 states and the
 * assessment reached all of them. See the note on COVERAGE in
 * src/lib/constants.ts.
 *
 * Run: node scripts/convert-lga-boundaries.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcPath = join(root, 'scripts', 'source-data', 'nga_admin2.geojson');
const lgasPath = join(root, 'public', 'data', 'lgas.json');
const outPath = join(root, 'public', 'geo', 'nigeria-lgas.geojson');

const PRIMARY_STATE_IDS = [
  'adamawa', 'akwa_ibom', 'anambra', 'bauchi', 'imo', 'jigawa',
  'kano', 'lagos', 'nasarawa', 'niger', 'oyo', 'rivers',
];

/** Our LGA id (`akwa_ibom.ndung_uko`) → GRID3's `adm2_name` for the same LGA.
 *  Every other LGA in these 12 states matches GRID3 on normalized name alone. */
const NAME_ALIASES = {
  'akwa_ibom.ndung_uko': 'Udung Uko',
  'bauchi.dambam': 'Damban',
  'imo.onuimo': 'Unuimo',
  'jigawa.birniwa': 'Biriniwa',
  'jigawa.birnin_kudu': 'Birni Kudu',
  'kano.danbatta': 'Dambatta',
  'kano.garun_malam': 'Garum Mallam',
  'kano.kano_minicipal_council': 'Kano Municipal',
  'kano.nassarawa': 'Nasarawa',
  'lagos.ifako_ijaiye': 'Ifako-Ijaye',
  'lagos.oshodi': 'Oshodi-Isolo',
  'niger.munya': 'Muya',
  'oyo.atisbo': 'Atigbo',
  'oyo.afijo': 'Afijio',
  'rivers.obioakpor': 'Obia/Akpor',
  'rivers.omuma': 'Omumma',
};

function slugify(v) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function norm(v) {
  return v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

const grid3 = JSON.parse(readFileSync(srcPath, 'utf8'));
const ourLgas = JSON.parse(readFileSync(lgasPath, 'utf8'));

const grid3ByState = new Map();
for (const f of grid3.features) {
  const stateId = slugify(f.properties.adm1_name);
  if (!PRIMARY_STATE_IDS.includes(stateId)) continue;
  if (!grid3ByState.has(stateId)) grid3ByState.set(stateId, []);
  grid3ByState.get(stateId).push(f);
}

const features = [];
const unmatched = [];

for (const stateId of PRIMARY_STATE_IDS) {
  const ours = ourLgas.filter((l) => l.parentId === stateId);
  const g3Features = grid3ByState.get(stateId) ?? [];
  const g3ByNorm = new Map(g3Features.map((f) => [norm(f.properties.adm2_name), f]));

  for (const l of ours) {
    const alias = NAME_ALIASES[l.id];
    const key = alias ? norm(alias) : norm(l.name);
    const match = g3ByNorm.get(key);
    if (!match) {
      unmatched.push(l.id);
      continue;
    }
    const lgaId = l.id.split('.')[1];
    features.push({
      type: 'Feature',
      properties: {
        id: l.id, // "state.lga" — matches AreaProfile.id and the explorer cube's LGA keys
        lgaId, // bare slug — matches FacilitySummary.lgaId and geoPath.lgaId
        stateId,
        name: match.properties.adm2_name, // GRID3's properly-cased display name
        pcode: match.properties.adm2_pcode,
      },
      geometry: match.geometry,
    });
  }
}

if (unmatched.length) {
  throw new Error(`Unmatched LGAs, add to NAME_ALIASES: ${unmatched.join(', ')}`);
}

const geojson = { type: 'FeatureCollection', features };
writeFileSync(outPath, JSON.stringify(geojson));
console.log(`Wrote ${features.length} LGA features (${PRIMARY_STATE_IDS.length} states) → ${outPath}`);
