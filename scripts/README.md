# Static export fallback

After `mbproject/scripts/prepare-vercel-dist.js`, run:

```powershell
node scripts/apply-static-fallback.js C:\path\to\static-export-dist
```

Run without a directory to update this repository's HTML. The installer is idempotent. Keep the versioned CSS/JS assets with the export (assets are cached immutably).

This restores exported animation widgets' visibility without JavaScript and initializes the three original slideshow images from each section's settings: 4-second interval, 1.6-second fade, looping and Ken Burns zoom. Existing overlay styles, typography, logo and banner remain authored in Elementor. Reduced-motion visitors receive a still image.

The v2 enhancement uses the complete 1280×476 banner on mobile, corrects copied page headings (including the Hex Bolts section heading), and supplies ElementsKit navigation with unique control IDs, keyboard/focus support, submenu toggling and breakpoint reset. Entrance effects use the original `data-settings` names/delays and Elementor duration classes. Image carousels use the already-exported Swiper library and authored slide counts, spacing, speed, looping and autoplay options. Their scrollable fallback prevents tablet overflow. Content stays visible without JavaScript; reduced motion skips entrance effects and carousel autoplay.

The installer removes orphan Magnific Popup initialization: the static export has no jQuery script, popup markup or popup consumers. It also removes duplicate global banner/font preloads. Font stylesheets and typography remain unchanged; browsers request the required font faces normally.

Verification (requires Playwright with Chrome, or `NODE_PATH` pointing to mb-browser/node_modules):

```powershell
node scripts/verify-responsive.js
```

Tests cover all 12 pages at 320, 390, 768, 1024 and 1440 pixels, real menu/submenu clicks, navigation, Escape, close, resize, headings, banner source/aspect ratio, completed animations, reduced motion, JavaScript-disabled visibility, broken images, overflow and console errors/warnings. Set `TEST_BASE` for live verification and `SHOTS` for screenshot/results output.
