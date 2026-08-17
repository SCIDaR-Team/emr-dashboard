import { useLayoutEffect, useRef, useState } from 'react';
import { CHART_FONT } from './chartTheme';

/**
 * Shared donut geometry and centre-stack typography.
 *
 * Ported from the NPHCDA dashboard's indicator donuts so the two products draw
 * a part-to-whole the same way: a thin band around a roomy hole, sized to the
 * card it sits in rather than to a constant, segments separated by a real gap
 * with rounded ends, and a centre stack fitted to the hole instead of guessed.
 *
 * Everything here is geometry and text metrics. Colour stays with `chartTheme`
 * and `bands` — this dashboard's three readiness colours and their textures are
 * load-bearing elsewhere and do not change with the ring style.
 */

/**
 * Ring hole as a fraction of the ring's outer radius. A band thick enough to
 * carry colour around a hole roomy enough for the centre stack to breathe; the
 * centre-stack fitter measures its text against the hole this produces.
 */
export const RING_HOLE_RATIO = 0.7;

/**
 * Horizontal space reserved BESIDE the ring, per side, for the outside labels.
 *
 * ECharts measures a pie label's allowed width from the END of its leader line
 * to the container edge, so this budget covers the leader plus the widest label
 * these rings produce — "(1,246)" is 45px at the 11px label size, and the leader
 * and its gap take another 10. Undersize it and ECharts silently truncates to
 * "(1,2…". Re-measure if the label font size or the counts' magnitude changes.
 */
export const LABEL_GUTTER = 58;

/** Ring diameter bounds — a floor for cramped cards, a ceiling for wide ones. */
export const DIA_MIN = 150;
export const DIA_MAX = 260;

export const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Live width of an element, so a ring can size itself from the card it is in
 * rather than from a hard-coded constant, tracking every later resize including
 * the sidebar collapsing.
 *
 * The first measurement runs in a LAYOUT effect, before the browser paints. With
 * a plain effect the chart painted one frame at the fallback width and then
 * jumped to its real size — a visible flash on every mount, and the only moment
 * at which the canvas ECharts had already sized and the radius we asked it to
 * draw could disagree.
 */
export function useBoxWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

// ---------------------------------------------------------------------------
// Donut centre stack — laid out as ONE rich-text block
// ---------------------------------------------------------------------------
//
// Several `graphic` elements pinned to fixed percentages of the container do not
// work: ECharts anchors a graphic's TOP EDGE at a percentage `top`, not its
// centre, so line boxes collide, the block's optical centre sits below the
// ring's, and nothing is ever measured against the width of the hole it has to
// sit in. One rich-text block fixes all three — leading is symmetric by
// construction, `top: 'middle'` centres the block on the ring centre, and the
// shared font size is fitted to the hole before it is drawn.

/** Canvas 2d context kept for text measurement only (never attached to the DOM). */
let measureCtx: CanvasRenderingContext2D | null | undefined;

function textWidth(text: string, weight: number, size: number): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * size * 0.58;
  measureCtx.font = `${weight} ${size}px ${CHART_FONT}`;
  return measureCtx.measureText(text).width;
}

/**
 * `head` is the figure the ring exists to report; `of` is a connector; `total`
 * is the context line under it.
 */
export type CentreRole = 'head' | 'of' | 'total';

export interface CentreLine {
  text: string;
  role: CentreRole;
}

/**
 * Size and weight of each line, as a fraction of the fitted headline size.
 *
 * Only the headline carries weight: bolding the context lines flattens the
 * hierarchy and the stack reads as one heavy block instead of a number with a
 * caption under it.
 */
const ROLE = {
  head: { scale: 1, min: 9, weight: 800 },
  of: { scale: 0.5, min: 9, weight: 400 },
  total: { scale: 0.58, min: 10, weight: 500 },
} as const;

/**
 * Largest headline size at which every line's ink fits inside the ring hole.
 *
 * The headline is capped as a fraction of the hole, not at a fixed pixel size: a
 * constant cap is only ever right for one ring diameter, and the centre stack
 * and the ring drift out of proportion as the ring resizes.
 */
function fitCentre(lines: CentreLine[], holeR: number) {
  // Ink of a line is roughly 0.75em tall, centred in its box; that band is what
  // has to clear the curve of the hole.
  const INK = 0.75;
  const MIN_HEAD = 9;
  const MAX_HEAD = Math.max(MIN_HEAD + 1, Math.round(holeR * 0.37));

  const metrics = (big: number) => {
    const size = (r: CentreRole) => Math.max(ROLE[r].min, Math.round(big * ROLE[r].scale));
    // Half-leading: tight on the number lines, generous on the connector — the
    // sum of a pair is the gap the eye actually reads, so both gaps around the
    // connector come out the same.
    const halfLead = (r: CentreRole) => big * (r === 'of' ? 0.2 : 0.08);
    const lineHeight = (r: CentreRole) => size(r) * INK + 2 * halfLead(r);
    return { size, lineHeight };
  };

  for (let big = MAX_HEAD; big > MIN_HEAD; big--) {
    const m = metrics(big);
    const height = lines.reduce((sum, l) => sum + m.lineHeight(l.role), 0);
    if (height > holeR * 2) continue;

    let y = -height / 2;
    let fits = true;
    for (const line of lines) {
      // The circle is narrowest at whichever edge of this line's ink band is
      // farther from the ring's centre.
      const edge = Math.abs(y + m.lineHeight(line.role) / 2) + (m.size(line.role) * INK) / 2;
      const halfWidth = Math.sqrt(Math.max(0, holeR * holeR - edge * edge));
      // 0.8 keeps a visible margin between the longest line and the inner edge
      // of the ring instead of letting text run up against it.
      if (textWidth(line.text, ROLE[line.role].weight, m.size(line.role)) > halfWidth * 2 * 0.8) {
        fits = false;
        break;
      }
      y += m.lineHeight(line.role);
    }
    if (fits) return m;
  }

  // Nothing fits: draw at the floor size rather than dropping the numbers.
  return metrics(MIN_HEAD);
}

/** The rich-text `graphic` for a ring's centre, or undefined when there is none. */
export function centreStack(
  lines: CentreLine[],
  holeR: number,
  theme: { text: string; muted: string },
) {
  if (!lines.length) return undefined;
  const fit = fitCentre(lines, holeR);

  const rich = Object.fromEntries(
    (['head', 'of', 'total'] as CentreRole[]).map((role) => [
      role,
      {
        fontFamily: CHART_FONT,
        fontSize: fit.size(role),
        fontWeight: ROLE[role].weight,
        lineHeight: fit.lineHeight(role),
        align: 'center' as const,
        color: role === 'head' ? theme.text : theme.muted,
      },
    ]),
  );

  return [
    {
      type: 'text' as const,
      left: 'center' as const,
      top: 'middle' as const,
      silent: true,
      style: {
        text: lines.map((l) => `{${l.role}|${l.text}}`).join('\n'),
        textAlign: 'center' as const,
        // zrender needs a base font/fill even when every span is styled.
        fill: theme.text,
        font: `800 ${fit.size('head')}px ${CHART_FONT}`,
        rich,
      },
    },
  ];
}
