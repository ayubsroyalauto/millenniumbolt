const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.SHOTS || path.join(root, '../mb-branding-shots');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/') p = '/index.html';
  if (!path.extname(p)) p += '.html';
  const f = path.join(root, decodeURIComponent(p));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = process.env.TEST_BASE || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];
  try {
    await Promise.all([1440, 1024, 768, 390, 320].map(async width => {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
      for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
        await page.goto(`${base}/${file === 'index.html' ? '' : file.replace('.html', '')}`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          document.querySelectorAll('img').forEach(i => i.loading = 'eager');
          await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
        });
        const audit = await page.evaluate(() => {
          const rect = el => el.getBoundingClientRect();
          const visible = el => rect(el).width && rect(el).height;
          const contrast = (a, b) => {
            const lum = s => s.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
            const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
          };
          const logos = [...document.querySelectorAll('img[src$="/millennium-bolts-logo.png"]')].filter(visible).map(el => ({ width: rect(el).width, height: rect(el).height, natural: el.naturalWidth / el.naturalHeight, x: rect(el).x, right: rect(el).right, alt: el.alt }));
          const headerHeight = rect(document.querySelector('.elementor-517')).height;
          const desktopNavHeight = parseFloat(getComputedStyle(document.querySelector('.elementor-517 .elementor-element-7dd6aab .elementskit-menu-container')).height);
          const headerLogo = document.querySelector('.elementor-517 img[src$="/millennium-bolts-logo.png"]');
          const actualLogo = [...document.querySelectorAll('.elementor-517 img')].find(visible);
          const overlaps = [...document.querySelectorAll('.elementor-517 .mb-menu, .elementor-517 .elementor-button')].filter(visible).some(el => {
            const a = rect(actualLogo || headerLogo), b = rect(el);
            return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
          });
          const footer = document.querySelector('.elementor-element-65092d56');
          const bg = getComputedStyle(footer).backgroundColor;
          const footerContrast = [...footer.querySelectorAll('.elementor-heading-title, .elementor-icon-list-text, .elementor-image-box-description')].filter(visible).map(el => contrast(getComputedStyle(el).color, bg));
          const buttons = [...document.querySelectorAll('.elementor-button')].filter(visible).map(el => { const s = getComputedStyle(el); return contrast(s.color, s.backgroundColor); });
          const isYellow = value => {
            const rgb = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
            if (!rgb || rgb.length < 3) return false;
            const [r, g, b] = rgb.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
            if (!d) return false;
            const hue = ((max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d) * 60 + 360) % 360;
            return hue >= 35 && hue <= 70 && d / max > .2;
          };
          const oldColors = [...document.querySelectorAll('.elementor *')].filter(visible).filter(el => {
            const s = getComputedStyle(el); return [s.color, s.backgroundColor, s.borderTopColor, s.fill].some(isYellow);
          }).map(el => el.className);
          return { logos, headerHeight, desktopNavHeight, overlaps, footer: bg, footerContrast, buttons, oldColors,
            h1: [...document.querySelectorAll('h1')].filter(el => visible(el) && !el.classList.contains('screen-reader-text')).map(el => getComputedStyle(el).color),
            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        const label = `${file} ${width}`;
        assert.equal(audit.logos.length, 2, label);
        assert(Math.abs(audit.logos[0].width - 130) < 1, `${label}: header logo ${JSON.stringify(audit.logos)}`);
        assert(Math.abs(audit.logos[1].width - 220) < 1, `${label}: footer logo`);
        assert(audit.desktopNavHeight <= 64, `${label}: desktop nav height ${audit.desktopNavHeight}`);
        if (width > 1024) assert(audit.headerHeight <= 170, `${label}: header height ${audit.headerHeight}`);
        audit.logos.forEach(l => { assert(Math.abs(l.width / l.height - l.natural) < .01); assert(l.x >= 0 && l.right <= width); assert(l.alt); });
        assert(!audit.overlaps, `${label}: header overlap`);
        assert(!audit.overflow, `${label}: overflow`);
        assert.equal(audit.footer, 'rgb(0, 16, 32)', label);
        assert(audit.footerContrast.every(c => c >= 4.5), `${label}: footer contrast`);
        assert(audit.buttons.every(c => c >= 4.5), `${label}: button contrast`);
        assert(audit.h1.every(c => c === 'rgb(255, 255, 255)'), `${label}: hero heading`);
        assert.deepEqual(audit.oldColors, [], `${label}: old colors`);
        assert.deepEqual(errors, [], label);
        const button = page.locator('.elementor-button:visible').first();
        if (await button.count()) {
          await button.focus();
          assert(await button.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 3; }), `${label}: focus`);
          await button.evaluate(el => el.blur());
        }
        await page.evaluate(() => scrollTo(0, 0));
        if (file !== 'home.html') await page.screenshot({ path: path.join(out, `${file.replace('.html', '')}-${width}.png`), fullPage: true });
        results.push({ file, width, ...audit });
        console.log('PASS branding', label);
      }
      await page.close();
    }));
    fs.writeFileSync(path.join(out, 'branding-results.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
