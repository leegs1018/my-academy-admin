import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/guide', '/support', '/privacy', '/terms'],
        disallow: ['/admin/', '/superadmin/', '/kiosk/', '/student/'],
      },
    ],
    sitemap: 'https://conedu.ai.kr/sitemap.xml',
  };
}
