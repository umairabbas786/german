export interface SeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  twitterImage?: string;
  robots?: string;
  structuredData: object;
}

function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function applySeo(config: SeoConfig): void {
  document.title = config.title;
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', config.canonical);

  updateMetaTag('description', config.description);
  updateMetaTag('keywords', config.keywords);
  updateMetaTag('robots', config.robots || 'index, follow');
  updateMetaTag('og:title', config.ogTitle, 'property');
  updateMetaTag('og:description', config.ogDescription, 'property');
  updateMetaTag('og:url', config.canonical, 'property');
  updateMetaTag('og:type', 'website', 'property');
  if (config.ogImage) updateMetaTag('og:image', config.ogImage, 'property');
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', config.ogTitle);
  updateMetaTag('twitter:description', config.ogDescription);
  if (config.twitterImage) updateMetaTag('twitter:image', config.twitterImage);

  let script = document.querySelector('script[data-dynamic-seo="true"]');
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-dynamic-seo', 'true');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(config.structuredData);
}
