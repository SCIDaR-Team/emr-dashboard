/**
 * Sidebar navigation.
 *
 * Seven modules. Names were reworked with the client in the redesign: the old
 * "State Summary" and "Assessment States" were indistinguishable as labels —
 * both said "states", and nothing told you one covered all 37 including desk
 * review while the other covered only the 12 visited, down to LGA. They are now
 * National Coverage and Assessed States. "Drill-Down Explorer" lost the BI
 * jargon to become Report Explorer, and the output page became the verb
 * "Generate Report" so the two cannot be confused with each other.
 *
 * Investment Plan is new: the costed schedule used to be a slab at the bottom
 * of State Summary, where nobody planning a budget would look for it.
 */

export interface NavItem {
  path: string;
  label: string;
  /** lucide-react icon name, resolved in Sidebar.tsx. */
  icon: string;
  /** One line under the page title. Says what this page has that the others
   *  do not — never a restatement of the label. */
  description: string;
  /** Shown as a launcher card on the home page. */
  showOnHome: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    // `/` is the landing page, which is not part of the shell — the rail's
    // first stop is the overview at `/dashboard`. Getting back out to the
    // landing page is the wordmark above this list, not an item in it.
    path: '/dashboard',
    label: 'Overview',
    icon: 'Home',
    description: 'What the assessment found',
    showOnHome: false,
  },
  {
    path: '/states',
    label: 'National Coverage',
    icon: 'Map',
    description: 'All 37 states and how each was evidenced',
    showOnHome: true,
  },
  {
    path: '/assessment',
    label: 'Assessed States',
    icon: 'BarChart3',
    description: 'The 12 states visited, down to LGA',
    showOnHome: true,
  },
  {
    path: '/facilities',
    label: 'Facility Scorecard',
    icon: 'ClipboardList',
    description: 'One facility, its gates and its actions',
    showOnHome: true,
  },
  {
    path: '/investment',
    label: 'Investment Plan',
    icon: 'Coins',
    description: 'What it will take, itemised and costed',
    showOnHome: true,
  },
  {
    path: '/explore',
    label: 'Report Explorer',
    icon: 'Compass',
    description: 'Explore the findings by geography and thematic area',
    showOnHome: true,
  },
  {
    path: '/reports',
    label: 'Generate Report',
    icon: 'FileText',
    description: 'Scope it, preview it, download it',
    showOnHome: true,
  },
];

/** Order for the circular next-arrow walkthrough in the page header. Follows
 *  the rail, so "next" means the item below the one you are on. */
export const MODULE_ORDER = NAV_ITEMS.map((item) => item.path);

export function nextModule(path: string): string | null {
  // Deep routes (`/assessment/kano`, `/facilities/:uuid`) should still resolve
  // to their module's successor rather than falling off the end.
  const i = MODULE_ORDER.findIndex(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  if (i === -1 || i === MODULE_ORDER.length - 1) return null;
  return MODULE_ORDER[i + 1] ?? null;
}

/** The module a pathname belongs to, for the rail's active state and the
 *  mobile bar's title. Longest match wins so `/states/kano` does not resolve
 *  to `/` and `/assessment/x/y` stays on Assessed States. */
export function moduleFor(path: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => path === item.path || path.startsWith(`${item.path}/`));
}
