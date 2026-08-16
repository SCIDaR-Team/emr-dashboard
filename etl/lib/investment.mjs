/**
 * Investment model.
 *
 * BLOCKED on a signed-off cost table. The prototype's unit costs are
 * placeholders — several rows repeat the same figure and the totals do not
 * multiply out — so they are deliberately not copied here. Publishing invented
 * naira figures against a government investment plan would be worse than
 * publishing none.
 *
 * The structure is settled (guide section 9.1): each failed minimum requirement
 * maps to zero or more investment items, each with a quantity formula, a unit
 * cost, and a priority. Fill COST_TABLE and QUANTITY_RULES and this becomes
 * live without touching anything downstream.
 */

/** item id -> { label, category, themeId, unitCostNGN, priority } */
export const COST_TABLE = {
  // e.g.
  // solar_backup: {
  //   label: 'Install inverter or solar back up power system',
  //   category: 'infrastructure',
  //   themeId: 'technical_infrastructure',
  //   unitCostNGN: null,   // <- awaiting sign-off
  //   priority: 'high',
  // },
};

/**
 * requirement id -> (row, derived) => { itemId, quantity }[]
 *
 * Quantity derivation is the real work here: "devices needed = service points
 * minus EMR-compliant devices" and its equivalents for each check.
 */
export const QUANTITY_RULES = {};

export function deriveInvestments(row, derived) {
  const items = [];

  for (const [requirementId, rule] of Object.entries(QUANTITY_RULES)) {
    for (const { itemId, quantity } of rule(row, derived) ?? []) {
      const spec = COST_TABLE[itemId];
      if (!spec || quantity <= 0) continue;
      const unitCost = spec.unitCostNGN;
      items.push({
        id: itemId,
        label: spec.label,
        themeId: spec.themeId,
        category: spec.category,
        priority: spec.priority,
        quantity,
        unitCostNGN: unitCost,
        totalCostNGN: unitCost == null ? null : unitCost * quantity,
        triggeredBy: [requirementId],
      });
    }
  }

  return items;
}

/** Sum a set of investment lines, tolerating unpriced items. */
export function totalInvestment(items) {
  const priced = items.filter((i) => i.totalCostNGN != null);
  return {
    totalNGN: priced.reduce((sum, i) => sum + i.totalCostNGN, 0),
    pricedCount: priced.length,
    unpricedCount: items.length - priced.length,
  };
}
