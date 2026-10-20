// Run after exporting: node scripts/apply-static-fallback.js [export-directory]
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const target = path.resolve(process.argv[2] || source);
fs.mkdirSync(path.join(target, 'assets'), { recursive: true });
for (const file of ['mb-static-v1.css', 'mb-static-v1.js']) {
  if (source !== target) fs.copyFileSync(path.join(source, 'assets', file), path.join(target, 'assets', file));
}
for (const file of fs.readdirSync(target).filter(file => file.endsWith('.html'))) {
  const filename = path.join(target, file);
  const html = fs.readFileSync(filename, 'utf8');
  if (/\bchr\(34\)/.test(html)) throw new Error(`Remove invalid legacy slideshow injection in ${file}`);
  if (html.includes('id="mb-static-fallback"')) continue;
  fs.writeFileSync(filename, html.replace('</head>',
    '<link id="mb-static-fallback" rel="stylesheet" href="/assets/mb-static-v1.css">\n' +
    '<script defer src="/assets/mb-static-v1.js"></script>\n</head>'));
}
console.log(`Static fallback installed: ${target}`);
