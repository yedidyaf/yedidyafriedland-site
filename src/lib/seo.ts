import { SITE, siteName } from '../site';
import { href } from './url';

/** Absolute URL for a site path (respects BASE_URL). */
export function absUrl(path: string, site: URL | undefined): string {
  return new URL(href(path), site).toString();
}

/** Stable JSON-LD ids, so every page refers to the same person and website. */
export const personId = (site: URL | undefined) => `${absUrl('/about/', site)}#person`;
export const websiteId = (site: URL | undefined) => `${absUrl('/', site)}#website`;

/** The site owner. Names in both languages so a search for either finds this site. */
export function personLd(site: URL | undefined) {
  return {
    '@type': 'Person',
    '@id': personId(site),
    name: SITE.name_he,
    alternateName: SITE.name_en,
    jobTitle: 'Software Developer and Programming Lecturer',
    description: 'מפתח תוכנה ומרצה לתכנות',
    url: absUrl('/about/', site),
    email: `mailto:${SITE.email}`,
    sameAs: [SITE.linkedin],
    knowsAbout: ['Python', 'C#', 'Object-Oriented Programming', 'Clean Code', 'Software Architecture'],
    knowsLanguage: ['he', 'en'],
  };
}

export function websiteLd(site: URL | undefined) {
  return {
    '@type': 'WebSite',
    '@id': websiteId(site),
    name: siteName,
    alternateName: [SITE.name_he, SITE.name_en, 'yedidyafriedland.com'],
    url: absUrl('/', site),
    description: `${SITE.tagline_he}: תרגול Python ו-C# עם הסבר אחרי כל שאלה.`,
    inLanguage: 'he',
    author: { '@id': personId(site) },
    publisher: { '@id': personId(site) },
  };
}
