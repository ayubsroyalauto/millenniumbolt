/* Static navigation: scoped per header instance, independent of ElementsKit. */
(() => {
  const mobile = matchMedia('(max-width: 1024px)');
  document.querySelectorAll('nav.ekit-wid-con').forEach((nav, index) => {
    const toggle = nav.querySelector('.elementskit-menu-hamburger');
    const panel = nav.querySelector('.elementskit-menu-container');
    if (!toggle || !panel) return;
    nav.classList.add('mb-menu');
    panel.id = `mb-menu-${index}`;
    toggle.setAttribute('aria-controls', panel.id);
    const close = nav.querySelector('.elementskit-menu-close');
    close?.setAttribute('aria-label', 'Close menu');
    const dropdowns = [...nav.querySelectorAll('.ekit-menu-dropdown-toggle')];
    dropdowns.forEach((link, n) => {
      const submenu = link.nextElementSibling;
      submenu.id = `mb-submenu-${index}-${n}`;
      link.setAttribute('aria-controls', submenu.id);
      link.setAttribute('role', 'button');
      submenu.querySelectorAll('a').forEach(a => a.removeAttribute('aria-label'));
    });
    function setOpen(open, restore = false) {
      nav.classList.toggle('mb-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      panel.inert = mobile.matches && !open;
      if (!open) dropdowns.forEach(link => {
        link.setAttribute('aria-expanded', 'false');
        link.parentElement.classList.remove('mb-submenu-open');
      });
      document.body.classList.toggle('mb-menu-active', !!document.querySelector('.mb-menu-open'));
      if (open) close?.focus();
      else if (restore) toggle.focus();
    }
    nav.addEventListener('click', event => {
      const target = event.target.closest('button, a, .elementskit-menu-overlay');
      if (!target) return;
      if (target === toggle || target === close || target.matches('.elementskit-menu-overlay')) {
        event.preventDefault(); event.stopImmediatePropagation();
        setOpen(target === toggle && !nav.classList.contains('mb-menu-open'), target !== toggle);
      } else if (dropdowns.includes(target)) {
        event.preventDefault(); event.stopImmediatePropagation();
        const open = target.getAttribute('aria-expanded') !== 'true';
        target.setAttribute('aria-expanded', String(open));
        target.parentElement.classList.toggle('mb-submenu-open', open);
      } else if (target.matches('a')) setOpen(false);
    }, true);
    nav.addEventListener('keydown', event => {
      if (event.key === ' ' && dropdowns.includes(event.target)) { event.preventDefault(); event.target.click(); }
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false, mobile.matches); }
      if (event.key === 'Tab' && mobile.matches && nav.classList.contains('mb-menu-open')) {
        const items = [...panel.querySelectorAll('a, button')].filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    mobile.addEventListener('change', () => setOpen(false));
    // Elementor swaps the two header templates at the phone/tablet boundary.
    matchMedia('(max-width: 767px)').addEventListener('change', () => setOpen(false));
    setOpen(false);
  });
})();

/* Entrance effects are intentionally disabled in the static export. Elementor's
   scroll-triggered effects can replay or jump while scrolling; keep content stable. */

// The export keeps Swiper but omits Elementor's image-carousel initializer.
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.Swiper !== 'function') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.elementor-widget-image-carousel').forEach(widget => {
    const element = widget.querySelector('.swiper');
    if (!element || element.swiper) return;
    let settings;
    try { settings = JSON.parse(widget.dataset.settings); } catch { return; }
    const count = Number(settings.slides_to_show) || 3;
    const spacing = suffix => Number(settings[`image_spacing_custom${suffix}`]?.size || settings.image_spacing_custom?.size) || 0;
    const swiper = new window.Swiper(element, {
      slidesPerView: Number(settings.slides_to_show_mobile) || 1,
      spaceBetween: spacing('_mobile'),
      slidesPerGroup: Number(settings.slides_to_scroll) || 1,
      speed: reduced.matches ? 0 : Number(settings.speed) || 400,
      loop: settings.infinite === 'yes',
      autoplay: !reduced.matches && settings.autoplay === 'yes' ? {
        delay: Number(settings.autoplay_speed) || 5000,
        pauseOnMouseEnter: settings.pause_on_hover === 'yes',
        disableOnInteraction: settings.pause_on_interaction === 'yes'
      } : false,
      navigation: { prevEl: widget.querySelector('.elementor-swiper-button-prev'), nextEl: widget.querySelector('.elementor-swiper-button-next') },
      breakpoints: {
        768: { slidesPerView: Number(settings.slides_to_show_tablet) || count, spaceBetween: spacing('_tablet') },
        1025: { slidesPerView: count, spaceBetween: spacing('') }
      }
    });
    reduced.addEventListener('change', () => { if (reduced.matches) { swiper.autoplay?.stop(); swiper.params.speed = 0; } });
    element.addEventListener('focusin', () => swiper.autoplay?.stop());
  });
});
