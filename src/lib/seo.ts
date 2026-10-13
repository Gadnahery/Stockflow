/** Site URL for canonicals, OG, sitemap. Override with VITE_SITE_URL. */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://stockflow-taupe-six.vercel.app')
).replace(/\/$/, '')

export const SITE_NAME = 'StockFlow'
export const DEFAULT_DESCRIPTION =
  'StockFlow is retail POS and inventory software for shops in Tanzania and East Africa. Record sales, track stock, monitor expenses, and review profit — including offline on phone or PC.'

export type SeoProps = {
  title: string
  description?: string
  path?: string
  type?: 'website' | 'article'
  noindex?: boolean
  image?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

function upsertJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/** Apply document title, meta, canonical, Open Graph, Twitter, optional JSON-LD. */
export function applySeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  type = 'website',
  noindex = false,
  image = `${SITE_URL}/og-default.png`,
  jsonLd,
}: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
  const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

  document.title = fullTitle
  upsertMeta('name', 'description', description)
  upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
  upsertMeta('name', 'author', SITE_NAME)
  upsertMeta('name', 'theme-color', '#007AFF')

  upsertLink('canonical', url)

  upsertMeta('property', 'og:type', type)
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:title', fullTitle)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', image)
  upsertMeta('property', 'og:locale', 'en_TZ')

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', fullTitle)
  upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', image)

  if (jsonLd) upsertJsonLd('sf-jsonld', jsonLd)
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: DEFAULT_DESCRIPTION,
    areaServed: ['TZ', 'KE', 'UG', 'RW'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      url: `${SITE_URL}/contact`,
      availableLanguage: ['en', 'sw'],
    },
  }
}

export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Windows, Android, iOS (PWA)',
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TZS',
      description: 'Contact for pricing and demo',
      url: `${SITE_URL}/pricing`,
    },
    featureList: [
      'Point of sale',
      'Inventory and stock movements',
      'Sales reports and profit & loss',
      'Customers and suppliers',
      'Expenses and cash shifts',
      'Offline sales with sync',
      'Multi-branch and team roles',
      'Barcode scanning',
    ],
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/resources?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  }
}

export function faqJsonLd(pairs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  }
}

export function articleJsonLd(opts: {
  title: string
  description: string
  path: string
  datePublished: string
  dateModified?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
  }
}
