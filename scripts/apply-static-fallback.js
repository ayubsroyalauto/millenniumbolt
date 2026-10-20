// Run after exporting: node scripts/apply-static-fallback.js [export-directory]
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const target = path.resolve(process.argv[2] || source);
fs.mkdirSync(path.join(target, 'assets'), { recursive: true });
for (const file of ['mb-static-v1.css', 'mb-static-v1.js', 'mb-static-v2.css', 'mb-static-v2.js']) {
  if (source !== target) fs.copyFileSync(path.join(source, 'assets', file), path.join(target, 'assets', file));
}
const banner = 'assets/wp-content/uploads/2026/10/millennium-bolts-banner-upscaled.png';
if (source !== target) {
  fs.mkdirSync(path.dirname(path.join(target, banner)), { recursive: true });
  fs.copyFileSync(path.join(source, banner), path.join(target, banner));
}
for (const file of fs.readdirSync(target).filter(file => file.endsWith('.html'))) {
  const filename = path.join(target, file);
  let html = fs.readFileSync(filename, 'utf8');
  // The export has no jQuery runtime, popup consumers or Magnific initializers.
  html = html.replace(/<script\b[^>]*id="magnific-popup-js"[^>]*><\/script>\s*/g, '');
  // Let the unchanged @font-face stylesheets select the actual font/subset.
  html = html.replace(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*(?:outfit-40e3e4f1|inter-dd14e726)\.woff2[^>]*>\s*/g, '');
  // This global image preload was duplicated even on pages without the banner.
  html = html.replace(/<link\b[^>]*rel="preload"[^>]*millennium-bolts-banner\.jpg[^>]*>\s*/g, '');
  const titles = { quality: 'Quality', services: 'Services', 'anchor-bolts': 'Anchor Bolts',
    'hex-bolts': 'Hex Bolts', 'hex-nuts': 'Hex Nuts', 'threaded-rods-stud-bolts': 'Threaded Rods &amp; Stud Bolts',
    'u-bolts': 'U-Bolts', washers: 'Washers' };
  if (titles[path.basename(file, '.html')]) html = html.replace(/(<h1\b[^>]*>)About Us(<\/h1>)/g,
    `$1${titles[path.basename(file, '.html')]}$2`);
  if (file === 'hex-bolts.html') html = html.replace('Types of Threaded Rods &amp; Stud Bolts', 'Types of Hex Bolts');
  html = html.replace(/(<source\b[^>]*srcset=")[^"]*millennium-bolts-banner-mobile.jpg"/g,
    '$1/assets/wp-content/uploads/2026/10/millennium-bolts-banner-upscaled.png"');
  if (!html.includes('id="mb-static-enhancements"')) html = html.replace('</head>',
    '<link id="mb-static-enhancements" rel="stylesheet" href="/assets/mb-static-v2.css">\n' +
    '<script defer src="/assets/mb-static-v2.js"></script>\n</head>');
  if (/\bchr\(34\)/.test(html)) throw new Error(`Remove invalid legacy slideshow injection in ${file}`);
  if (!html.includes('id="mb-static-fallback"')) html = html.replace('</head>',
    '<link id="mb-static-fallback" rel="stylesheet" href="/assets/mb-static-v1.css">\n' +
    '<script defer src="/assets/mb-static-v1.js"></script>\n</head>');
  fs.writeFileSync(filename, html);
}
console.log(`Static fallback installed: ${target}`);
