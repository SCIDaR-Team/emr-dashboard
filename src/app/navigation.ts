/**
 * Sidebar navigation.
 *
 * Five modules. The first four follow the ERA Figma prototype; the Drill-Down
 * Explorer is additional — it delivers the LGA-level analysis the FRS requires
 * but the prototype never covered. See build guide §7 and §8.
 */

export interface NavItem {
  path: string;
  label: string;
  /** lucide-react icon name, resolved in Sidebar.tsx. */
  icon: string;
  description: string;
  /** Shown as a launcher card on the home page. */
  showOnHome: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    // `/` is the landing page, which is not part of the shell — the rail's
    // first stop is the module launcher at `/dashboard`. Getting back out to
    // the landing page is the wordmark above this list, not an item in it.
    path: '/dashboard',
    label: 'Home',
    icon: 'Home',
    description: 'Assessment overview and module launcher',
    showOnHome: false,
  },
  {
    path: '/states',
    label: 'State Summary',
    icon: 'Map',
    description: 'Readiness across states using state-level findings',
    showOnHome: true,
  },
  {
    path: '/assessment',
    label: 'Assessment States',
    icon: 'BarChart3',
    description: 'Readiness across the 12 visited assessment states',
    showOnHome: true,
  },
  {
    path: '/facilities',
    label: 'Facility Scorecard',
    icon: 'ClipboardList',
    description: 'Detailed facility readiness, minimum requirements and required actions',
    showOnHome: true,
  },
  {
    path: '/explore',
    label: 'Drill-Down Explorer',
    icon: 'Compass',
    description:
      'Explore readiness by geography and thematic area, from national down to facility',
    showOnHome: true,
  },
  {
    path: '/reports',
    label: 'Report Builder',
    icon: 'FileText',
    description: 'Generate a scoped, stakeholder-ready report and download it',
    showOnHome: true,
  },
];

/** Order for the circular next-arrow walkthrough in the page header. */
export const MODULE_ORDER = [
  '/dashboard',
  '/states',
  '/assessment',
  '/explore',
  '/facilities',
  '/reports',
];

export function nextModule(path: string): string | null {
  const i = MODULE_ORDER.indexOf(path);
  if (i === -1 || i === MODULE_ORDER.length - 1) return null;
  return MODULE_ORDER[i + 1] ?? null;
}
