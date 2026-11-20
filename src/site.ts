/** Site-wide constants. Personal details of the site owner (public by design). */
export const SITE = {
  name_he: 'ידידיה פרידלנד',
  name_en: 'Yedidya Friedland',
  tagline_he: 'לומדים תכנות דרך מבחנים',
  tagline_en: 'Learn programming through tests',
  linkedin: 'https://www.linkedin.com/in/yedidya-friedland%F0%9F%92%AB-252a67277',
  email: 'hello@yedidyafriedland.com',
  /** Cloudflare Web Analytics token (cookieless). Empty = no analytics script. */
  cfBeaconToken: import.meta.env.PUBLIC_CF_BEACON_TOKEN ?? '',
};
export const siteName = `${SITE.name_he} - ${SITE.name_en}`;
