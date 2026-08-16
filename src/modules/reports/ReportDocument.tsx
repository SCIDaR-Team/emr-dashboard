/**
 * Render a `ReportDoc` as real DOM.
 *
 * This element is both the on-screen preview and the thing `exportElementToPDF`
 * photographs, which is the whole reason the preview is not an iframe: it themes
 * with the app, it is selectable, a screen reader can walk it, and the PDF
 * cannot disagree with it.
 *
 * ## Tokens
 *
 * Every colour here comes from this app's own semantic tokens — `foreground`,
 * `muted-foreground`, `border`, `surface`, `brand-*`, and the three band
 * colours. The SFM page this layout is ported from uses `ink-primary`,
 * `ink-secondary`, `ink-muted`, `hairline`, `primary-500`, `surface-muted` and
 * `status-bad`, none of which exist in this Tailwind config. A Tailwind class
 * naming a colour that is not defined does not error — it emits nothing and the
 * element inherits, which is exactly how NPHCDA's `--c-bg` silently rendered
 * black in the export module. So: no class in this file names a token that is
 * not in `tailwind.config.js`.
 *
 * ## Bands
 *
 * The distribution bar carries `BAND_CLASSES[band].texture` alongside the fill,
 * because colour alone is not a carrier here — see the note in `lib/bands.ts`.
 * A report is the single most likely thing to be printed in greyscale, so this
 * is the surface where dropping the texture would hurt most.
 */

import { BAND_CLASSES, BAND_LABEL } from '@/lib/bands';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Band } from '@/lib/types';
import type { ReportBlock, ReportDoc } from './reportModel';

const DASH = '—';

/** Band order for the distribution bar: best first, matching every other surface. */
const BAR_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

function Kpis({ items }: { items: { label: string; value: string; sublabel?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{k.label}</p>
          <p className="mt-0.5 text-lg font-bold leading-tight text-brand-700">{k.value}</p>
          {k.sublabel && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Distribution({
  counts,
  total,
  caption,
}: {
  counts: Record<Band, number>;
  total: number;
  caption?: string;
}) {
  return (
    <div>
      <div
        className="flex h-6 w-full overflow-hidden rounded-md border border-border"
        role="img"
        aria-label={BAR_ORDER.map(
          (b) => `${BAND_LABEL[b]} ${counts[b]} of ${total}`,
        ).join(', ')}
      >
        {BAR_ORDER.map((band) => {
          const pct = total ? (counts[band] / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={band}
              className={cn(BAND_CLASSES[band].bg, BAND_CLASSES[band].texture)}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {BAR_ORDER.map((band) => (
          <span key={band} className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-sm border border-border',
                BAND_CLASSES[band].bg,
                BAND_CLASSES[band].texture,
              )}
              aria-hidden
            />
            <span className="text-muted-foreground">
              {BAND_LABEL[band]} —{' '}
              <span className="font-semibold text-foreground">{formatCount(counts[band])}</span>{' '}
              ({percentOf(counts[band], total)})
            </span>
          </span>
        ))}
      </div>
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/**
 * A 1–5 score as a bar.
 *
 * The bar starts at 1, not 0: 1 is the floor of the scale, so drawing from zero
 * would make a facility that scored the minimum look as though it had a fifth of
 * a bar rather than none.
 */
function ScoreBars({ items }: { items: { label: string; score: number | null; note?: string }[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = item.score == null ? 0 : ((item.score - 1) / 4) * 100;
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-foreground">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                {item.score == null ? DASH : formatScore(item.score, 2)}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            {item.note && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.note}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Table({
  columns,
  rows,
  numericColumns = [],
  caption,
}: {
  columns: string[];
  rows: (string | number | null)[][];
  numericColumns?: number[];
  caption?: string;
}) {
  return (
    <figure className="m-0">
      {caption && (
        <figcaption className="mb-1.5 text-sm font-semibold text-foreground">
          {caption}
        </figcaption>
      )}
      {/* Wide tables scroll inside their own box rather than pushing the
          document sideways. The PDF capture takes the full element, so nothing
          is lost to the scroll. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    'px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    numericColumns.includes(i) ? 'text-right' : 'text-left',
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/60 last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'px-2 py-1.5',
                      numericColumns.includes(ci)
                        ? 'text-right tabular-nums'
                        : 'text-left',
                      // A blank is "not measured", never zero — the same rule the
                      // Excel export follows by leaving the cell genuinely empty.
                      cell == null ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {cell == null ? DASH : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case 'kpis':
      return <Kpis items={block.items} />;
    case 'prose':
      return <p className="text-sm leading-relaxed text-foreground/85">{block.text}</p>;
    case 'caveat':
      return (
        <p className="rounded-md border-l-2 border-brand-500 bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {block.text}
        </p>
      );
    case 'table':
      return (
        <Table
          columns={block.columns}
          rows={block.rows}
          numericColumns={block.numericColumns}
          caption={block.caption}
        />
      );
    case 'distribution':
      return (
        <Distribution counts={block.counts} total={block.total} caption={block.caption} />
      );
    case 'scoreBars':
      return <ScoreBars items={block.items} />;
  }
}

interface ReportDocumentProps {
  doc: ReportDoc;
  /** The element the PDF export captures. */
  innerRef?: React.Ref<HTMLDivElement>;
}

export function ReportDocument({ doc, innerRef }: ReportDocumentProps) {
  return (
    <article
      ref={innerRef}
      // `bg-surface` explicitly rather than inherited: html2canvas paints what
      // it finds, and a transparent root rasterises to black on some backends.
      className="bg-surface px-6 py-7 sm:px-8"
      aria-label={`${doc.title} report preview`}
    >
      <header className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-brand-700 sm:text-2xl">
          {doc.title}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{doc.subtitle}</p>

        {/* Provenance, on the page as well as in the PDF header block. A report
            circulated as a screenshot still has to carry its own scope. */}
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          {doc.notes.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-muted-foreground">{label}</dt>
              <dd className="m-0 text-foreground/80">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {doc.sections.map((section) => (
        <section key={section.id} className="mt-6 first:mt-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700">
            {section.title}
          </h2>
          <div className="mt-3 space-y-3.5">
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-7 border-t border-border pt-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Generated from the EMR Readiness Assessment dashboard. Figures reflect the
          population and filters stated above. Readiness bands are equal terciles of the 1–5
          scale: Not ready below {formatScore(1 + 4 / 3, 2)}, Ready at or above{' '}
          {formatScore(1 + 8 / 3, 2)}.
        </p>
      </footer>
    </article>
  );
}
