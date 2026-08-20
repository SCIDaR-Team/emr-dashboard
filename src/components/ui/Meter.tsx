/**
 * The measurement primitives: score tracks, band composition bars, stat tiles,
 * band marks and the maturity meter.
 *
 * These carry the redesign's one colour rule, so every surface that shows a
 * number reaches for them rather than styling a bar inline:
 *
 *   hue means band            — the three readiness colours, always with a
 *                               texture and a label beside them
 *   darkness means magnitude  — the single-hue score ramp, --s1 → --s5
 *
 * See the header comment in src/styles/globals.css for why the two are kept
 * apart, and BAND_TEXTURE in src/lib/bands.ts for the non-colour channel.
 */

import {
  BAND_CLASSES,
  BAND_LABEL,
  MATURITY_BANDS,
  toBand,
  toMaturityLevel,
} from '@/lib/bands';
import { cn } from '@/lib/cn';
import { scorePct } from '@/lib/scale';
import { formatScore } from '@/lib/format';

/** Scores are read against cut points at 2.9 and 3.9, so these render at two
 *  decimals: at one, a 2.85 prints as "2.9" and looks like it is sitting on
 *  the Not-ready cut instead of below it. */
const score2 = (v: number | null | undefined) => formatScore(v, 2);
import type { Band, MaturityLevel } from '@/lib/types';


// ---------------------------------------------------------------------------
// Band mark
// ---------------------------------------------------------------------------

/**
 * A small textured square that carries a band beside a figure.
 *
 * Values themselves stay in ink. Recolouring a number to encode its band makes
 * the number harder to read and puts meaning in a channel a colour-blind or
 * greyscale reader loses; the mark takes the meaning instead.
 */
export function BandMark({
  band,
  className,
}: {
  band: Band | null;
  className?: string;
}) {
  const label = band ? BAND_LABEL[band] : 'Not scored';
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-[1px] align-baseline',
        band ? cn(BAND_CLASSES[band].bg, BAND_CLASSES[band].texture) : 'bg-nodata',
        className,
      )}
    />
  );
}

/** Band mark + value, the pairing used in every ranked table. */
export function ScoreCell({ value }: { value: number | null }) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <BandMark band={toBand(value)} />
      <span className="mono">{score2(value)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score track
// ---------------------------------------------------------------------------

/**
 * A 1–5 score as a thin bar, optionally with a reference marker.
 *
 * One colour for every bar. Tinting a bar by the value its own length already
 * shows spends the hue channel on information the chart has given twice, and
 * leaves nothing for the reference line to say.
 */
export function ScoreTrack({
  value,
  reference,
  className,
  title,
}: {
  value: number | null;
  /** Usually the national mean. Drawn above the fill and extended past the
   *  track, so the ticks still read where a bar crosses the line. */
  reference?: number | null;
  className?: string;
  title?: string;
}) {
  if (value == null) {
    return (
      <div
        title={title ? `${title} — not scored` : 'Not scored'}
        className={cn('hatch-secondary h-[7px] rounded-[1px] bg-surface-sunk', className)}
      />
    );
  }
  return (
    <div
      title={title}
      className={cn('relative h-[7px] rounded-[1px] bg-surface-sunk', className)}
    >
      <span
        className="absolute inset-y-0 left-0 block rounded-r-[3px] bg-score-3"
        style={{ width: `${scorePct(value)}%` }}
      />
      {reference != null && (
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 z-10 block w-px bg-muted-foreground"
          style={{ left: `${scorePct(reference)}%` }}
        />
      )}
    </div>
  );
}

/** The label row that sits above a ScoreTrack in every panel. */
export function ScoreRow({
  label,
  value,
  reference,
  maturity = false,
}: {
  label: string;
  value: number | null;
  reference?: number | null;
  maturity?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px] text-muted-foreground">
        <span className="min-w-0 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-3">
          {maturity && <MaturityMeter score={value} />}
          <span className="mono font-semibold text-foreground">
            <BandMark band={toBand(value)} className="mr-1.5" />
            {score2(value)}
          </span>
        </span>
      </div>
      <ScoreTrack
        value={value}
        reference={reference}
        title={`${label} — ${score2(value)} of 5`}
      />
    </div>
  );
}

/**
 * The 1 / mean / 5 rule under a stack of ScoreRows.
 *
 * `referenceLabel` names what the tick actually is. It defaults to the national
 * mean because that is what every original caller passes, but sub-theme rows
 * are read against their own domain's mean instead — and a rule labelled
 * "national mean" while marking something else is worse than no rule at all.
 */
export function ScoreAxis({
  reference,
  referenceLabel = 'national mean',
}: {
  reference?: number | null;
  referenceLabel?: string;
}) {
  return (
    <div className="mono mt-2.5 flex justify-between border-t border-border pt-2 text-[9.5px] tracking-wider text-muted-foreground">
      <span>1</span>
      {reference != null ? (
        <span>
          {referenceLabel} {formatScore(reference, 2)} │
        </span>
      ) : (
        <span>3</span>
      )}
      <span>5</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Band composition
// ---------------------------------------------------------------------------

const STACK_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/**
 * A 100% stacked band bar: how a population splits across the three bands.
 *
 * Segments are separated by a 2px surface gap rather than by a border. A border
 * adds a fourth colour between every pair of fills and, at the 12px heights
 * these run at, reads as its own segment.
 */
export function BandStack({
  distribution,
  label,
  className,
}: {
  distribution: Record<Band, number>;
  label?: string;
  className?: string;
}) {
  const total = STACK_ORDER.reduce((sum, b) => sum + (distribution[b] ?? 0), 0);
  if (!total) return null;

  return (
    <div className={cn('flex h-3 min-w-[150px] gap-[2px]', className)}>
      {STACK_ORDER.map((band) => {
        const n = distribution[band] ?? 0;
        if (!n) return null;
        const pct = (n / total) * 100;
        return (
          <span
            key={band}
            title={`${label ? `${label} — ` : ''}${BAND_LABEL[band]} ${n.toLocaleString()} · ${pct.toFixed(1)}%`}
            className={cn(
              'block rounded-[1px]',
              BAND_CLASSES[band].bg,
              BAND_CLASSES[band].texture,
            )}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

/** The three-band key. Present whenever a BandStack is, because identity must
 *  never rest on colour alone. */
export function BandLegend({
  includeNoData = false,
  noDataLabel = 'No facility data',
  className,
}: {
  includeNoData?: boolean;
  noDataLabel?: string;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] tracking-wide text-muted-foreground',
        className,
      )}
    >
      {STACK_ORDER.map((band) => (
        <li key={band} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('block h-2 w-5', BAND_CLASSES[band].bg, BAND_CLASSES[band].texture)}
          />
          {BAND_LABEL[band]}
        </li>
      ))}
      {includeNoData && (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="hatch-secondary block h-2 w-5 bg-surface-sunk" />
          {noDataLabel}
        </li>
      )}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Maturity
// ---------------------------------------------------------------------------

const MATURITY_STEP: Record<MaturityLevel, string> = {
  nascent: 'bg-score-1',
  emerging: 'bg-score-2',
  developing: 'bg-score-3',
  institutionalized: 'bg-score-4',
  optimized: 'bg-score-5',
};

/**
 * The five-level maturity scale as a position on the score ramp.
 *
 * Nascent → Optimized is an ordered scale of the same 1–5 score, and the
 * ordinal ramp has exactly five steps, so maturity needs no palette of its own.
 * It used to have one — a red→orange→yellow→green traffic light sitting beside
 * the three readiness colours — and the two scales competed rather than
 * cooperating. Cumulative fill reads as distance travelled toward Optimized.
 */
export function MaturityMeter({
  score,
  size = 'sm',
  className,
  labelClassName,
}: {
  score: number | null;
  /** `xl` is the tile size: the meter is the tile's whole content there, so it
   *  is set to read as a figure rather than as an annotation beside one. */
  size?: 'sm' | 'lg' | 'xl';
  className?: string;
  /** Class for the text label. Give it a width where several meters stack and
   *  the ragged label lengths would otherwise shunt the step blocks sideways. */
  labelClassName?: string;
}) {
  const level = toMaturityLevel(score);
  const index = level ? MATURITY_BANDS.findIndex((b) => b.level === level) : -1;
  const band = index >= 0 ? MATURITY_BANDS[index] : null;
  const label = band ? band.label : 'Not scored';

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap', className)}
      title={
        band
          ? `${band.label} · level ${index + 1} of 5 (${band.min.toFixed(1)}–${band.max.toFixed(1)} of 5)`
          : 'Not scored'
      }
    >
      <span className="flex gap-[1.5px]" aria-hidden>
        {MATURITY_BANDS.map((b, i) => (
          <span
            key={b.level}
            className={cn(
              'block rounded-[1px]',
              size === 'xl'
                ? 'h-[19px] w-2.5'
                : size === 'lg'
                  ? 'h-[13px] w-2'
                  : 'h-2.5 w-1.5',
              level && i <= index ? MATURITY_STEP[level] : 'bg-surface-sunk',
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          'mono uppercase tracking-[0.09em]',
          size === 'xl'
            ? 'text-[15px] font-semibold tracking-[0.06em] text-foreground'
            : 'text-muted-foreground',
          size === 'lg' ? 'text-[10.5px]' : size === 'sm' ? 'text-[9.5px]' : '',
          labelClassName,
        )}
      >
        {label}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat tiles
// ---------------------------------------------------------------------------

/** A row of hairline-separated figures. The grid is a 1px-gap sheet so the
 *  rules between tiles are the container's background showing through. */
export function TileRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-px border border-border bg-border', className)}>
      {children}
    </div>
  );
}

export function Tile({
  label,
  value,
  suffix,
  note,
  band,
  aside,
  className,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  note?: React.ReactNode;
  band?: Band;
  /**
   * A second reading of the same figure, on the figure's own line after the
   * suffix — a readiness badge beside a score. Outside the mono block rather
   * than inside it, so a pill does not inherit the tabular face the number is
   * set in. For a second *number*, add a tile.
   */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 bg-surface px-3.5 py-3', className)}>
      <div className="mono mb-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
        {band && <BandMark band={band} className="h-2 w-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
        <span className="mono text-[25px] font-semibold leading-none tracking-tight text-foreground">
          {value}
          {suffix && (
            <span className="ml-1.5 text-xs font-medium tracking-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
        {aside}
      </div>
      {note && <div className="mt-1.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sequential scale legend
// ---------------------------------------------------------------------------

const RAMP_CLASS = ['bg-score-1', 'bg-score-2', 'bg-score-3', 'bg-score-4', 'bg-score-5'];

/**
 * The key for a sequential choropleth.
 *
 * Mandatory wherever `GeoDatum.step` is used: a ramp with no scale is a
 * picture of nothing. Bounds are printed rather than described because the
 * domains are fitted to the data on screen, so "dark = worse" is not enough —
 * the reader needs to know worse *than what*.
 */
export function ScaleLegend({
  lo,
  hi,
  format,
  caption,
  note,
  noDataLabel = 'no data',
  className,
}: {
  lo: number;
  hi: number;
  format: (v: number) => string;
  caption: string;
  note?: React.ReactNode;
  noDataLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('mt-3', className)}>
      <p className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
        {caption}
      </p>
      <div className="flex items-start gap-0.5">
        {RAMP_CLASS.map((bg, i) => {
          const from = lo + ((hi - lo) * i) / 5;
          const to = lo + ((hi - lo) * (i + 1)) / 5;
          return (
            <div key={bg} className="min-w-0 flex-1" title={`${format(from)} – ${format(to)}`}>
              <div className={cn('h-[9px] rounded-[1px]', bg)} />
              <div className="mono mt-1 text-[9px] text-muted-foreground">{format(from)}</div>
            </div>
          );
        })}
        <div className="shrink-0 pl-2.5">
          <div className="hatch-secondary h-[9px] w-7 rounded-[1px] bg-surface-sunk" />
          <div className="mono mt-1 text-[9px] text-muted-foreground">{noDataLabel}</div>
        </div>
      </div>
      {note && <p className="mono mt-2 text-[10.5px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
