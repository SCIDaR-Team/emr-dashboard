import { Laptop, MonitorX, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SERVICE_POINTS } from '@/lib/constants';
import { titleCaseName } from '@/lib/format';
import type { ServicePoint } from '@/lib/types';

const SERVICE_POINT_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_POINTS.map((p) => [p.id, p.label]),
);

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
 *
 * Descriptive only — no per-point score. The v2 scoring methodology folded the
 * old per-point device/digital-skills/infrastructure/action-plan/shared-staff
 * indicators into facility-wide Workflow and Technical Infrastructure
 * indicators, so there is no longer a column to read a per-point score from.
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
        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-3">
          {point.hasDuplicateDocumentation && <Flag label="Duplicate records" />}
          {point.hasHybridDocumentation && <Flag label="Hybrid documentation" />}
          {point.hasBottleneck && <Flag label="Workflow bottleneck" />}
        </div>
      )}
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
