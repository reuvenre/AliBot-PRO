import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexus.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/register`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
