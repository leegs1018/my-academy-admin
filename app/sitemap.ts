import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://conedu.ai.kr';
  const now = new Date();

  return [
    { url: base,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/samples`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/pricing`,       lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/notices`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/kiosk`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/guide`,         lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/register`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/support`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,         lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
