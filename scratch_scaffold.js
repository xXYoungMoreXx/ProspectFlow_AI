const fs = require('fs');
const path = require('path');

const basePath = path.join(process.cwd(), 'packages', 'templates');
if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });

const templates = [
  { dir: 'T001-landing-page', type: 'landing', pages: 1, animation: 'low', lh: 95 },
  { dir: 'T002-institucional-5p', type: 'institutional', pages: 5, animation: 'medium', lh: 90 },
  { dir: 'T003-blog-portfolio', type: 'blog', pages: 3, animation: 'low', lh: 95 },
  { dir: 'T004-ecommerce-basico', type: 'ecommerce', pages: 4, animation: 'low', lh: 85 },
  { dir: 'T005-portfolio-criativo', type: 'portfolio', pages: 2, animation: 'high', lh: 88 }
];

const nextConfigContent = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self';" },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
`;

for (const t of templates) {
  const dirPath = path.join(basePath, t.dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  
  const meta = {
    serviceType: t.type,
    pageCount: t.pages,
    animationLevel: t.animation,
    lighthouseBaseline: t.lh
  };
  
  fs.writeFileSync(path.join(dirPath, 'metadata.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(dirPath, 'next.config.ts'), nextConfigContent);
}
console.log('Templates created');
