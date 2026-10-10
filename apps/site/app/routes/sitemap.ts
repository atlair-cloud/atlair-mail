import { absoluteUrl, allPages, modified } from '~/lib/seo'

export function loader() {
  const urls = allPages
    .map((page) =>
      [
        '  <url>',
        `    <loc>${absoluteUrl(page.path)}</loc>`,
        `    <lastmod>${modified}</lastmod>`,
        '    <image:image>',
        `      <image:loc>${absoluteUrl(page.image)}</image:loc>`,
        '    </image:image>',
        '  </url>',
      ].join('\n'),
    )
    .join('\n')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  )
}
