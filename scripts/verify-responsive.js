const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.SHOTS || path.join(root, '..', 'mb-responsive-shots');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/') p = '/index.html';
  if (!path.extname(p)) p += '.html';
  const file = path.join(root, decodeURIComponent(p));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.TEST_BASE || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    await Promise.all((process.env.TEST_WIDTHS || '320,390,768,1024,1440').split(',').map(Number).map(async width => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], warnings = [], fonts = new Set();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (['warning', 'error'].includes(msg.type())) warnings.push(msg.text()); });
      page.on('request', req => { if (/\.woff2?/.test(req.url())) fonts.add(req.url()); });
      for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html') && (!process.env.TEST_FILES || process.env.TEST_FILES.split(',').includes(f)))) {
        errors.length = 0; warnings.length = 0;
        await page.goto(`${base}/${file === 'index.html' ? '' : file.replace('.html', '')}`, { waitUntil: 'networkidle' });
        if (!['about-us.html', 'index.html', 'home.html'].includes(file)) {
          const h1 = page.locator('h1').first();
          assert(!/About Us/.test(await h1.innerText()), `${file}: wrong hero`);
          if (['quality.html', 'services.html'].includes(file)) {
            assert.equal((await h1.innerText()).toLowerCase(), file.replace('.html', ''));
            await h1.screenshot({ path: path.join(out, `${file}-${width}.png`) });
          }
        }
        if (width <= 1024) {
          const toggle = page.locator('.elementskit-menu-hamburger:visible').first();
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          const nav = page.locator('.mb-menu-open');
          const products = nav.locator('.ekit-menu-dropdown-toggle');
          await products.click();
          assert.equal(await products.getAttribute('aria-expanded'), 'true');
          assert(await nav.locator('a[href="/hex-bolts"]').isVisible());
          await products.click();
          assert.equal(await products.getAttribute('aria-expanded'), 'false');
          await page.keyboard.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
          await toggle.click();
          await nav.locator('.elementskit-menu-close').click();
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        }
        await page.evaluate(async () => {
          document.querySelectorAll('img').forEach(img => img.loading = 'eager');
          await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
          for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); }
        });
        await page.waitForTimeout(2600);
        if (file === 'about-us.html') {
          const carousel = page.locator('.elementor-image-carousel-wrapper').first();
          assert(await carousel.evaluate(el => !!el.swiper), 'original carousel not initialized');
          await carousel.evaluate(el => el.swiper.autoplay.stop());
          const before = await carousel.evaluate(el => el.swiper.realIndex);
          await carousel.locator('.elementor-swiper-button-next').click();
          await page.waitForTimeout(450);
          assert.notEqual(await carousel.evaluate(el => el.swiper.realIndex), before, 'carousel next did not work');
        }
        const audit = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          overflowDetails: [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect();
            if (!r.width || r.right <= innerWidth + 1) return false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(p).overflowX)) return false;
            return true;
          }).slice(0, 15).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })),
          hidden: [...document.querySelectorAll('.elementor-invisible')].filter(el => el.getClientRects().length && (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0')).length,
          broken: [...document.images].filter(img => img.getClientRects().length && !img.naturalWidth).map(img => img.src),
          animated: document.querySelectorAll('[data-mb-animation-finished]').length,
          animationRepeats: [...document.querySelectorAll('[data-mb-animation-start-count]')].filter(el => el.dataset.mbAnimationStartCount !== '1').length
        }));
        assert.equal(audit.hidden, 0); assert.deepEqual(audit.broken, []);
        assert.equal(audit.animationRepeats, 0, `${file} ${width}: entrance animations must start once`);
        assert.equal(audit.overflow, false, `${file} ${width} overflow: ${JSON.stringify(audit.overflowDetails)}`);
        assert.deepEqual(errors, [], `${file} runtime errors`);
        assert.deepEqual(warnings, [], `${file} console warnings`);
        if (file === 'index.html') {
          const banner = page.locator('.elementor-element-mbannerhtml1 img');
          await banner.scrollIntoViewIfNeeded();
          const image = await banner.evaluate(img => ({ src: img.currentSrc, natural: img.naturalWidth / img.naturalHeight, rendered: img.width / img.height }));
          assert(Math.abs(image.natural - image.rendered) < 0.04);
          if (width < 768) { assert(image.src.endsWith('banner-upscaled.png')); assert(Math.abs(image.natural - 1280 / 476) < 0.01); }
          await banner.screenshot({ path: path.join(out, `banner-${width}.png`) });
          assert(audit.animated > 0, 'authored animations did not finish');
          if (width <= 1024) {
            await page.evaluate(() => scrollTo(0, 0));
            await page.locator('.elementskit-menu-hamburger:visible').first().click();
            await page.locator('.mb-menu-open .ekit-menu-dropdown-toggle').click();
            await page.screenshot({ path: path.join(out, `menu-${width}.png`) });
            await page.locator('.mb-menu-open a[href="/hex-bolts"]').click();
            await page.waitForURL('**/hex-bolts');
            await page.locator('.elementskit-menu-hamburger:visible').first().click();
            await page.setViewportSize({ width: width < 768 ? 768 : 390, height: 900 });
            await page.waitForFunction(() => !document.querySelector('.mb-menu-open'));
            assert.equal(await page.locator('body.mb-menu-active').count(), 0);
            await page.locator('.elementskit-menu-hamburger:visible').first().click();
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.waitForFunction(() => !document.querySelector('.mb-menu-open'));
            await page.setViewportSize({ width, height: 900 });
          } else {
            await page.evaluate(() => scrollTo(0, 0));
            const products = page.locator('.ekit-menu-dropdown-toggle:visible').first();
            await products.click();
            await page.locator('.mb-menu a[href="/hex-bolts"]:visible').click();
            await page.waitForURL('**/hex-bolts');
          }
        }
        results.push({ file, width, ...audit, errors: [...errors], warnings: [...warnings] });
        console.log('PASS', width, file);
      }
      results.push({ width, fontRequests: [...fonts] });
      await page.close();
    }));
    for (const options of [{ reducedMotion: 'reduce' }, { javaScriptEnabled: false }]) {
      const page = await browser.newPage(options);
      await page.goto(base);
      assert.equal(await page.locator('.elementor-invisible').evaluateAll(els => els.filter(el => getComputedStyle(el).visibility === 'hidden').length), 0);
      if (options.reducedMotion) assert.equal(await page.locator('[data-mb-animation]').count(), 0);
      await page.goto(`${base}/about-us`);
      assert.equal(await page.locator('.elementor-invisible').evaluateAll(els => els.filter(el => getComputedStyle(el).visibility === 'hidden').length), 0);
      if (options.reducedMotion) assert(await page.locator('.elementor-image-carousel-wrapper').evaluateAll(els => els.every(el => el.swiper && !el.swiper.autoplay.running)));
      await page.close();
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
