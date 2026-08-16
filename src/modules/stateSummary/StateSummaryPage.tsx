import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState, SectionCard } from '@/components/ui';
import { COVERAGE } from '@/lib/constants';

/**
 * Module 2 — State Summary.
 *
 * Readiness across all 37 states using state-level findings: readiness counts,
 * national choropleth, five-theme domain scores (this is the only module where
 * Leadership & Governance appears), investment by theme, and the 6-month
 * roadmap matrix.
 *
 * BLOCKED: the state-level assessment output is not among the supplied files.
 * `ERA dataset_v4.xlsx` is facility-level only and covers 12 states, so there
 * is no source yet for Leadership & Governance scores, the Overall State
 * Readiness rating, or any finding for the 25 secondary states. Guide §17.1.
 *
 * The shell below is real; each panel is marked with what it needs.
 */
export default function StateSummaryPage() {
  return (
    <>
      <PageHeader
        title="State Summary"
        subtitle={`Readiness across ${COVERAGE.statesTotal} states using state-level findings`}
      >
        {/* TODO: State and Readiness level dropdowns */}
      </PageHeader>

      <div className="grid gap-5 px-4 pb-8 sm:px-6 lg:gap-6 lg:px-8 xl:grid-cols-2">
        <SectionCard
          title="Readiness by state"
          subtitle="Ready / Moderately ready / Not ready, with national choropleth"
        >
          <EmptyState
            title="Awaiting state-level assessment data"
            message="Needs the state-level instrument output: Overall State Readiness per state and Leadership & Governance scores. Not present in the supplied files."
          />
        </SectionCard>

        <SectionCard
          title="Investments required"
          subtitle="Total and per thematic area"
        >
          <EmptyState
            title="Awaiting cost table"
            message="Unit costs in the prototype are placeholders. Needs a signed-off cost table before figures can be shown."
          />
        </SectionCard>

        <Card className="xl:col-span-2">
          <h2 className="text-base font-semibold text-brand-700">
            Roadmap (6 month plan)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Activity and cost per month, by readiness archetype.
          </p>
          <EmptyState
            title="Awaiting cost table and horizon decision"
            message="The prototype compresses all three archetypes into one 6-month plan; the assessment report gives per-archetype timelines of under 6 months, 6–12 months, and Year 1+. Confirm which is intended."
          />
        </Card>
      </div>
    </>
  );
}
