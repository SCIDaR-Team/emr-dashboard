/**
 * Value normalisation for the ingest.
 *
 * Three problems the source data presents, in order of how badly they bite:
 *   1. multi-selects are space-delimited inside one cell
 *   2. everything is an ODK slug, not a display string
 *   3. at least one column is CP1252/UTF-8 double-encoded
 */

const ACRONYMS = {
  PHC: 'PHC', PHCC: 'PHCC', HC: 'HC', MCH: 'MCH', CHC: 'CHC', RHC: 'RHC',
  GH: 'GH', FHC: 'FHC', FMC: 'FMC', BHCPF: 'BHCPF', EMR: 'EMR', LGA: 'LGA',
  FCT: 'FCT', ODK: 'ODK', DHIS2: 'DHIS2', ICT: 'ICT', OIC: 'OIC', MTN: 'MTN',
  ISP: 'ISP', UPS: 'UPS', SOP: 'SOP', HMIS: 'HMIS',
};

/**
 * Slug → display name.
 *
 * Only a fallback. Where the XLSForm `choices` sheet has an authoritative
 * label, use it — this is a heuristic and will mangle names the choice list
 * would have got right.
 */
export function titleCaseName(value) {
  if (typeof value !== 'string' || !value) return '';
  const cleaned = value
    .replace(/[_\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '')
    .trim();
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      return ACRONYMS[upper] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Repair `â‰¤10` → `≤10`. Present in patient_consultations, possibly elsewhere. */
export function fixMojibake(value) {
  if (typeof value !== 'string' || !/[ÂÃâ€]/.test(value)) return value;
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

/**
 * Split a multi-select cell into tokens.
 *
 * `"laptop tablet smartphone"` → `['laptop', 'tablet', 'smartphone']`.
 * Comparing the raw cell against one option undercounts badly: `laptop tablet`,
 * `tablet laptop` and `laptop` all mean "has a laptop".
 */
export function tokenize(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== 'none');
}

export function hasOption(value, option) {
  return tokenize(value).includes(option);
}

export function toNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function toBool(value, truthy = ['yes', 'true', '1']) {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  return truthy.includes(String(value).trim().toLowerCase());
}

/** Stable id for URLs and geo keys. */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
