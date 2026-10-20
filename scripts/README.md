# Static export fallback

After `mbproject/scripts/prepare-vercel-dist.js`, run:

```powershell
node scripts/apply-static-fallback.js C:\path\to\static-export-dist
```

Run without a directory to update this repository's HTML. The installer is idempotent. Keep the versioned CSS/JS assets with the export (assets are cached immutably).

This restores exported animation widgets' visibility without JavaScript and initializes the three original slideshow images from each section's settings: 4-second interval, 1.6-second fade, looping and Ken Burns zoom. Existing overlay styles, typography, logo and banner remain authored in Elementor. Reduced-motion visitors receive a still image.
