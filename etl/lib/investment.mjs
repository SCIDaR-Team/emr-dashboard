/**
 * Investment items — action, quantity and priority, no cost.
 *
 * The build guide's investment model (§9.1) splits cleanly in two: item
 * *quantities* are derivable from the assessment data; unit *costs* are not
 * — no naira figure exists in any supplied file, and the Figma's own unit
 * costs are placeholders that don't multiply out. Publishing invented naira
 * figures against a government investment plan would be worse than
 * publishing none, so `unitCostNGN`/`totalCostNGN` stay null throughout.
 * `quantity`, `priority`, `label` and `category` are all real, computed from
 * what actually failed at this facility.
 *
 * Priority has no client-specified rule (§17.4 point 3 — still open). The
 * default below: requirements that block EMR use outright (power, wiring,
 * devices, point-of-care capture, a shared system, workflow SOPs) are High;
 * process/administrative gaps (data-quality checks, reporting, feedback
 * loops, technical-support routing) are Medium; appointing dedicated ICT
 * support is Low, matching the one priority the Figma mock actually shows
 * ("Appoint an IT support personnel for the LGA — Low"). Flagged as
 * provisional, not a client decision.
 */

/** requirement id -> item template, for the 22 that are actually measured. */
const REQUIREMENT_ITEMS = {
  'ti.electricity': {
    label: 'Install inverter or solar backup power system',
    category: 'infrastructure',
    themeId: 'technical_infrastructure',
    priority: 'high',
  },
  'ti.wiring': {
    label: 'Rehabilitate electrical wiring and sockets',
    category: 'infrastructure',
    themeId: 'technical_infrastructure',
    priority: 'high',
  },
  'ti.device_per_point': {
    label: 'Procure additional computing device(s)',
    category: 'infrastructure',
    themeId: 'technical_infrastructure',
    priority: 'high',
  },
  'ti.printer': {
    label: 'Procure a printer for the facility',
    category: 'infrastructure',
    themeId: 'technical_infrastructure',
    priority: 'medium',
  },
  'ti.backup': {
    label: 'Implement automated daily data backup',
    category: 'infrastructure',
    themeId: 'technical_infrastructure',
    priority: 'medium',
  },
  'wf.role_specific': {
    label: 'Provide role-specific digital-skills training',
    category: 'workforce',
    themeId: 'workforce_capacity',
    priority: 'high',
  },
  'wf.literate': {
    label: 'Provide digital-literacy training for all staff',
    category: 'workforce',
    themeId: 'workforce_capacity',
    priority: 'high',
  },
  'wf.focal_person': {
    label: 'Appoint a full-time EMR focal person',
    category: 'workforce',
    themeId: 'workforce_capacity',
    priority: 'high',
  },
  'wf.ict_support': {
    label: 'Appoint an ICT support person for the facility',
    category: 'workforce',
    themeId: 'workforce_capacity',
    priority: 'low',
  },
  'wf.resolution_time': {
    label: 'Establish a faster technical-issue resolution pathway',
    category: 'workforce',
    themeId: 'workforce_capacity',
    priority: 'medium',
  },
  'wk.digitizable': {
    label: 'Map and document digitisable workflows',
    category: 'workflow',
    themeId: 'workflow_transition',
    priority: 'medium',
  },
  'wk.sop': {
    label: 'Develop and print EMR workflow SOPs',
    category: 'workflow',
    themeId: 'workflow_transition',
    priority: 'high',
  },
  'wk.point_of_care': {
    label: 'Equip service points for point-of-care data capture',
    category: 'workflow',
    themeId: 'workflow_transition',
    priority: 'high',
  },
  'wk.records_shared': {
    label: 'Adopt one shared digital system across all service points',
    category: 'workflow',
    themeId: 'workflow_transition',
    priority: 'high',
  },
  'wk.no_duplicates': {
    label: 'Eliminate duplicate patient documentation across points',
    category: 'workflow',
    themeId: 'workflow_transition',
    priority: 'medium',
  },
  'du.realtime': {
    label: 'Enable real-time data capture at point of care',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'high',
  },
  'du.quality': {
    label: 'Implement data-quality checks in the digital system',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'medium',
  },
  'du.decisions': {
    label: 'Establish routine use of data for decision-making',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'medium',
  },
  'du.reporting': {
    label: 'Enable built-in EMR reporting',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'medium',
  },
  'du.exchange': {
    label: 'Enable automated data exchange (e.g. DHIS2 integration)',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'medium',
  },
  'du.feedback': {
    label: 'Establish a feedback loop for service improvement',
    category: 'data_use',
    themeId: 'data_use_reporting',
    priority: 'medium',
  },
};

/** Environment risks flagged per service point -> the repair item. */
const RISK_ITEMS = {
  water_leaks: { label: 'Repair leaking roof', priority: 'high' },
  poor_ventilation: { label: 'Improve room ventilation', priority: 'medium' },
};

/** Amenities checked per service point -> the item if a present point lacks it. */
const AMENITY_ITEMS = {
  desk: { label: 'Procure additional desks', priority: 'medium' },
  chairs_patient: { label: 'Purchase additional patient chairs', priority: 'medium' },
  chairs_staff: { label: 'Purchase additional staff chairs', priority: 'medium' },
  sockets: { label: 'Install additional power sockets', priority: 'high' },
  fan: { label: 'Install additional fans', priority: 'low' },
  lockable_door: { label: 'Install lockable doors', priority: 'medium' },
};

function item(id, spec, quantity, triggeredBy) {
  return {
    id,
    label: spec.label,
    themeId: spec.themeId ?? 'technical_infrastructure',
    category: spec.category ?? 'infrastructure',
    priority: spec.priority,
    quantity,
    unitCostNGN: null,
    totalCostNGN: null,
    triggeredBy,
  };
}

/**
 * One facility's investment list — items with a quantity and a priority,
 * never a cost. `minimumRequirements` decides which items apply;
 * `servicePoints` supplies the two counted ones (device gap, environment/
 * amenity repairs) their quantities.
 */
export function deriveInvestments(minimumRequirements, derived, servicePoints) {
  const items = [];
  const failed = new Set(
    minimumRequirements.filter((r) => r.met === false).map((r) => r.id),
  );

  for (const [id, spec] of Object.entries(REQUIREMENT_ITEMS)) {
    if (!failed.has(id)) continue;

    if (id === 'ti.device_per_point') {
      const gap = Math.max(
        0,
        (derived.minimumRequiredDeviceCount ?? 0) - (derived.verifiedCompliantDeviceCount ?? 0),
      );
      items.push(item(id, spec, Math.max(1, gap), [id]));
      continue;
    }

    items.push(item(id, spec, 1, [id]));
  }

  const present = servicePoints.filter((p) => p.present);

  if (failed.has('ti.environment')) {
    for (const [risk, spec] of Object.entries(RISK_ITEMS)) {
      const count = present.filter((p) => p.infrastructure.includes(risk)).length;
      if (count > 0) {
        items.push(item(`ti.environment.${risk}`, { ...spec, category: 'infrastructure', themeId: 'technical_infrastructure' }, count, ['ti.environment']));
      }
    }
  }

  for (const [amenity, spec] of Object.entries(AMENITY_ITEMS)) {
    const missing = present.filter((p) => !p.infrastructure.includes(amenity)).length;
    if (missing > 0) {
      items.push(item(`ti.amenity.${amenity}`, { ...spec, category: 'infrastructure', themeId: 'technical_infrastructure' }, missing, ['ti.environment']));
    }
  }

  return items;
}

/** Sum a set of investment lines. Every quantity is real; no cost exists yet. */
export function totalInvestment(items) {
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    pricedCount: 0,
    unpricedCount: items.length,
  };
}

/**
 * Roll up a set of facilities' investment lines into one list — same item id
 * across facilities sums its quantity, so "procure additional laptops"
 * becomes one line with the total gap across the population, not one line
 * per facility.
 */
export function rollUpInvestments(facilitiesInScope) {
  const byId = new Map();
  for (const f of facilitiesInScope) {
    for (const inv of f.investments ?? []) {
      const existing = byId.get(inv.id);
      if (existing) {
        existing.quantity += inv.quantity;
        existing.facilityCount += 1;
      } else {
        byId.set(inv.id, { ...inv, facilityCount: 1 });
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.quantity - a.quantity);
}
