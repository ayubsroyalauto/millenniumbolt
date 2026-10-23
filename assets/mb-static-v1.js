/* Lightweight replacement for slideshow initialization omitted by the export. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-settings]').forEach(section => {
    let settings;
    try { settings = JSON.parse(section.dataset.settings); } catch { return; }
    const gallery = settings.background_slideshow_gallery;
    if (settings.background_background !== 'slideshow' || !gallery?.length ||
        section.querySelector('.elementor-background-slideshow, .mb-slides')) return;

    const duration = Number(settings.background_slideshow_slide_duration) || 5000;
    const fade = Number(settings.background_slideshow_transition_duration) || 500;
    const layer = document.createElement('div');
    layer.className = 'mb-slides';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--mb-fade', `${fade}ms`);
    const slides = gallery.map(item => {
      const slide = document.createElement('div');
      slide.className = 'mb-slide';
      const image = document.createElement('div');
      image.className = 'elementor-background-slideshow__slide__image';
      image.style.backgroundImage = `url(${JSON.stringify(item.url)})`;
      slide.append(image);
      layer.append(slide);
      return slide;
    });
    section.classList.add('mb-static-slideshow');
    section.prepend(layer);
    let current = 0;
    function activate(index) {
      slides[current].classList.remove('is-active');
      current = index;
      slides[current].classList.add('is-active');
      layer.dataset.activeSlide = String(current);
      // Keep the slideshow's simple fade; omit decorative Ken Burns zoom.
    }
    activate(0);
    if (slides.length < 2 || reducedMotion.matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      if (current === slides.length - 1 && settings.background_slideshow_loop !== 'yes') {
        window.clearInterval(timer);
        return;
      }
      activate((current + 1) % slides.length);
    }, duration);
  });
})();
