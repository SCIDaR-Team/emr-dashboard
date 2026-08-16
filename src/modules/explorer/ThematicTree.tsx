import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SUB_THEMES_BY_THEME, THEMES } from '@/lib/themes';
import { useDataContext } from '@/state/dataContext';
import { COVERAGE } from '@/lib/constants';
import { formatCount, percentOf } from '@/lib/format';
import type { IndicatorDef, ThemeNodeId } from '@/lib/types';

interface ThematicTreeProps {
  selected: ThemeNodeId;
  onSelect: (id: ThemeNodeId) => void;
  /** Leadership & Governance resolves only above facility level. */
  geoLevel: 'national' | 'state' | 'lga' | 'facility';
  /** Its own card on the desktop rail; bare inside the small-screen drawer,
   *  which is already a panel. */
  className?: string;
}

/**
 * Coverage below which an indicator's aggregate describes its respondents
 * rather than the country.
 *
 * Not a statistical threshold — a legibility one. Several indicators sit behind
 * skip patterns ("how long did you run paper and EMR in parallel" is only asked
 * of facilities that have an EMR), so their national figure is drawn from 158
 * facilities out of 2,804. That is a perfectly good number about those 158 and a
 * badly misleading one about Nigeria, and the difference has to be visible
 * before the click, not after.
 */
const LOW_COVERAGE = 0.5;

/**
 * The thematic axis: overall → thematic area → sub-thematic area → indicator.
 *
 * Leadership & Governance is state-level only, so at LGA and facility level it
 * is shown disabled with the reason rather than hidden — a theme that silently
 * vanishes reads as missing data.
 *
 * The fourth level is lazy in two senses: its labels come from `indicators.json`
 * (already loaded — it drives the Scorecard) and its *data* comes from a 99 KB
 * matrix fetched only once something on it is selected. Expanding a sub-theme to
 * read the questions costs nothing.
 */
export function ThematicTree({
  selected,
  onSelect,
  geoLevel,
  className = 'card p-3',
}: ThematicTreeProps) {
  const { indicators } = useDataContext();

  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(() => {
    const parts = selected.split('.');
    return new Set(parts.length > 1 ? [parts[0] as string] : []);
  });
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(() => {
    // A shared link landing on an indicator should open the rail at it.
    const parts = selected.split('.');
    return new Set(parts.length > 2 ? [`${parts[0]}.${parts[1]}`] : []);
  });

  /** Scored indicators by sub-theme, in rubric order. */
  const bySubTheme = useMemo(() => {
    const out = new Map<string, IndicatorDef[]>();
    for (const indicator of indicators.data) {
      if (!indicator.scoreColumns.length) continue;
      const bucket = out.get(indicator.subThemeId);
      if (bucket) bucket.push(indicator);
      else out.set(indicator.subThemeId, [indicator]);
    }
    for (const list of out.values()) list.sort((a, b) => a.n - b.n);
    return out;
  }, [indicators.data]);

  const toggle = (set: Set<string>, apply: (next: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const toggleTheme = toggle(expandedThemes, setExpandedThemes);
  const toggleSub = toggle(expandedSubs, setExpandedSubs);

  const belowStateLevel = geoLevel === 'lga' || geoLevel === 'facility';

  return (
    <nav aria-label="Thematic area" className={className}>
      <button
        type="button"
        onClick={() => onSelect('overall')}
        className={cn(
          'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-brand-50',
          selected === 'overall' && 'bg-brand-50 text-brand-700',
        )}
      >
        All themes (overall readiness)
      </button>

      <ul className="mt-1 space-y-0.5">
        {THEMES.map((theme) => {
          const subs = SUB_THEMES_BY_THEME[theme.id];
          const isOpen = expandedThemes.has(theme.id);
          const disabled = !theme.facilityLevel && belowStateLevel;

          return (
            <li key={theme.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                  onClick={() => toggleTheme(theme.id)}
                  className="grid h-8 w-6 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  title={
                    disabled
                      ? 'Leadership & Governance is assessed at state level only'
                      : undefined
                  }
                  onClick={() => onSelect(theme.id)}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                    disabled
                      ? 'cursor-not-allowed text-muted-foreground/60'
                      : 'hover:bg-brand-50',
                    selected === theme.id && 'bg-brand-50 font-medium text-brand-700',
                  )}
                >
                  {theme.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {theme.role === 'core' ? 'core' : ''}
                  </span>
                </button>
              </div>

              {isOpen && (
                <ul className="ml-6 space-y-0.5 border-l border-border pl-2">
                  {subs.map((sub) => {
                    const questions = bySubTheme.get(sub.id) ?? [];
                    const subOpen = expandedSubs.has(sub.id);

                    return (
                      <li key={sub.id}>
                        <div className="flex items-center">
                          <button
                            type="button"
                            aria-label={subOpen ? 'Collapse questions' : 'Expand questions'}
                            aria-expanded={subOpen}
                            disabled={disabled || questions.length === 0}
                            title={
                              questions.length === 0
                                ? 'No scored questions — this sub-theme is assessed at state level'
                                : `${questions.length} scored question${questions.length === 1 ? '' : 's'}`
                            }
                            onClick={() => toggleSub(sub.id)}
                            className={cn(
                              'grid h-7 w-5 place-items-center text-muted-foreground',
                              questions.length === 0
                                ? 'cursor-not-allowed opacity-30'
                                : 'hover:text-foreground',
                            )}
                          >
                            {subOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(sub.id)}
                            title={sub.label}
                            className={cn(
                              'flex-1 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                              disabled
                                ? 'cursor-not-allowed text-muted-foreground/60'
                                : 'text-muted-foreground hover:bg-brand-50 hover:text-foreground',
                              selected === sub.id &&
                                'bg-brand-50 font-medium text-brand-700',
                            )}
                          >
                            {sub.shortLabel}
                            <span className="ml-1.5 text-xs opacity-60">
                              {sub.questionCount}
                            </span>
                          </button>
                        </div>

                        {subOpen && questions.length > 0 && (
                          <ul className="ml-5 space-y-0.5 border-l border-border pl-2">
                            {questions.map((indicator) => (
                              <IndicatorItem
                                key={indicator.id}
                                indicator={indicator}
                                selected={selected === indicator.id}
                                disabled={disabled}
                                onSelect={onSelect}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * One rubric question.
 *
 * Carries two things the reader needs before selecting it: how many facilities
 * answered it, and whether it counts towards any score. One scored question —
 * EMR implementation status — is excluded from the published theme means and is
 * marked so; it is offered because it holds the answer to the question this
 * dashboard is most often asked, not because it contributes to readiness.
 */
function IndicatorItem({
  indicator,
  selected,
  disabled,
  onSelect,
}: {
  indicator: IndicatorDef;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: ThemeNodeId) => void;
}) {
  const coverage = indicator.answeredCount / COVERAGE.facilitiesScored;
  const unanswered = indicator.answeredCount === 0;
  const thin = !unanswered && coverage < LOW_COVERAGE;
  const unweighted = indicator.class === 'contextual';

  return (
    <li>
      <button
        type="button"
        disabled={disabled || unanswered}
        onClick={() => onSelect(indicator.id)}
        title={
          unanswered
            ? `${indicator.label} — no facility carries a score for this question.`
            : `${indicator.label}\n\nAnswered by ${formatCount(indicator.answeredCount)} of ${formatCount(COVERAGE.facilitiesScored)} facilities (${percentOf(indicator.answeredCount, COVERAGE.facilitiesScored)}).`
        }
        className={cn(
          'w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
          disabled || unanswered
            ? 'cursor-not-allowed text-muted-foreground/50'
            : 'text-muted-foreground hover:bg-brand-50 hover:text-foreground',
          selected && 'bg-brand-50 font-medium text-brand-700',
        )}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="shrink-0 font-mono text-[10px] opacity-70">
            Q{indicator.n}
          </span>
          <span className="line-clamp-2 flex-1">{indicator.label}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]">
          {unanswered ? (
            <span className="text-notready">Never answered</span>
          ) : (
            <span className={cn('tabular-nums', thin && 'text-moderate')}>
              n={formatCount(indicator.answeredCount)}
              {thin && ' — partial coverage'}
            </span>
          )}
          {unweighted && <span className="opacity-70">· unweighted</span>}
        </span>
      </button>
    </li>
  );
}
