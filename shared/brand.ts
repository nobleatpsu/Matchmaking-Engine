/**
 * Product branding in one place. Change these strings to rename the product;
 * nothing else in the codebase hard-codes the name.
 *
 * Note: official Penn State marks (the Nittany Lion shield, the PSU wordmark)
 * should only be added through the university's brand approval process. The
 * app uses a neutral typographic mark until then.
 */
export const BRAND = {
  /** Full product name, used in titles, the sidebar, printed briefs. */
  name: 'Penn State Research Partnerships',
  /** Institution line shown above the product name. */
  institution: 'Penn State',
  /** Product line shown under the institution. */
  product: 'Research Partnerships',
  /** Short descriptor for the browser tab and meta description. */
  tagline: 'Industry × faculty matchmaking',
  /** Owning office — shown in footers. */
  owner: 'Office of the Senior Vice President for Research',
} as const;
