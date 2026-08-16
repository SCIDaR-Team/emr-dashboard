import { Check, Minus, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ChecklistItem {
  id: string;
  label: string;
  /** null means the instrument cannot answer this one — render "not assessed",
   *  never a failure. Two of the 24 requirements are permanently null. */
  met: boolean | null;
}

export interface MinimumRequirementsChecklistProps {
  items: ChecklistItem[];
  className?: string;
}

/**
 * Pass/fail checklist for one theme's minimum requirements.
 *
 * A `null` result is not a third kind of failure — it means the ODK
 * instrument never asked the question at this facility (e.g. a unique patient
 * identifier, or how many staff were trained rather than whether any were).
 * Rendering it as a red cross would tell facilities to fix something the
 * assessment never measured.
 */
export function MinimumRequirementsChecklist({
  items,
  className,
}: MinimumRequirementsChecklistProps) {
  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className={cn(item.met == null ? 'text-muted-foreground italic' : 'text-foreground')}>
            {item.label}
          </span>
          {item.met === true && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ready-wash text-ready">
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Met</span>
            </span>
          )}
          {item.met === false && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-notready-wash text-notready">
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Not met</span>
            </span>
          )}
          {item.met == null && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Minus className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Not assessed</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
