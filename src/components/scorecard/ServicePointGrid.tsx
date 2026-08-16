import { Laptop, MonitorX, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BAND_CLASSES } from '@/lib/bands';
import { toBand } from '@/lib/bands';
import { SERVICE_POINTS } from '@/lib/constants';
import { titleCaseName } from '@/lib/format';
import type { ServicePoint } from '@/lib/types';

const SERVICE_POINT_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_POINTS.map((p) => [p.id, p.label]),
);

const SCORE_LABEL: Record<keyof ServicePoint['scores'], string> = {
  device: 'Device',
  digitalSkills: 'Digital skills',
  infrastructure: 'Infrastructure',
  actionPlan: 'Action plan',
  sharedStaff: 'Staffing',
};

export interface ServicePointGridProps {
  servicePoints: ServicePoint[];
  className?: string;
}

/**
 * The five points of care, reshaped in the ETL from the raw `section_m_workflow`
 * columns (§4.3 of the build guide). A point absent at this facility still
 * renders as a card — reading "not present" — rather than disappearing, so the
 * grid is always five cells and an absent point is never mistaken for missing
 * data.
 */
export function ServicePointGrid({ servicePoints, className }: ServicePointGridProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', className)}>
      {servicePoints.map((sp) => (
        <ServicePointCard key={sp.id} point={sp} />
      ))}
    </div>
  );
}

function ServicePointCard({ point }: { point: ServicePoint }) {
  const label = point.label || SERVICE_POINT_LABEL[point.id] || titleCaseName(point.id);

  if (!point.present) {
    return (
      <div className="card flex flex-col gap-2 p-4 opacity-60">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
          <MonitorX className="h-4 w-4 shrink-0" aria-hidden />
          Not present at this facility
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="text-sm font-semibold text-foreground">{label}</p>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Laptop className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {point.usesDigitalSystems
            ? point.digitalSystemName ?? 'Digital system in use'
            : 'Paper-based'}
          {point.hasFunctionalDevice === true &&
            point.deviceTypes.length > 0 &&
            ` · ${point.deviceTypes.map(titleCaseName).join(', ')}`}
          {point.hasFunctionalDevice === false && ' · No functional device'}
        </span>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {point.totalStaff != null ? `${point.totalStaff} staff` : 'Staffing not assessed'}
          {point.dedicatedStaff != null && ` · ${point.dedicatedStaff} dedicated`}
        </span>
      </div>

      {(point.hasDuplicateDocumentation || point.hasHybridDocumentation || point.hasBottleneck) && (
        <div className="flex flex-wrap gap-1.5">
          {point.hasDuplicateDocumentation && <Flag label="Duplicate records" />}
          {point.hasHybridDocumentation && <Flag label="Hybrid documentation" />}
          {point.hasBottleneck && <Flag label="Workflow bottleneck" />}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-3">
        {(Object.keys(SCORE_LABEL) as (keyof ServicePoint['scores'])[]).map((key) => {
          const score = point.scores[key];
          const band = toBand(score);
          return (
            <span
              key={key}
              title={`${SCORE_LABEL[key]}: ${score ?? 'not assessed'}`}
              className={cn(
                'inline-flex items-baseline gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                band ? cn(BAND_CLASSES[band].wash, BAND_CLASSES[band].text) : 'bg-muted text-muted-foreground',
              )}
            >
              {SCORE_LABEL[key]}
              {/* The chip's tint was the only thing carrying the band, and the
                  label names the measure rather than the result. The score
                  itself says both, and is what someone acting on the card
                  actually wants — an em dash where it was never assessed, which
                  is not a zero. */}
              <span className="font-semibold tabular-nums">{score ?? '—'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Flag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-moderate-wash px-2 py-0.5 text-[10px] font-medium text-moderate">
      {label}
    </span>
  );
}
