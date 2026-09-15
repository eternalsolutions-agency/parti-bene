(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    document.documentElement.classList.add("reduced-motion");
    return;
  }

  document.documentElement.classList.add("motion-enabled");
  const selector = "main section > .container, .card, .path, .panel, .category, .offer-card, .step";
  let revealIndex = 0;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -35px" });

  function registerReveal(element) {
    if (!(element instanceof Element) || element.classList.contains("reveal-item")) return;
    element.classList.add("reveal-item");
    element.style.setProperty("--reveal-delay", Math.min(revealIndex++ % 6, 5) * 55 + "ms");
    observer.observe(element);
  }

  document.querySelectorAll(selector).forEach(registerReveal);
  new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(selector)) registerReveal(node);
      node.querySelectorAll?.(selector).forEach(registerReveal);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  const hero = document.querySelector(".hero");
  if (hero && window.matchMedia("(min-width: 901px)").matches) {
    let ticking = false;
    const updateParallax = () => {
      const shift = Math.max(-35, Math.min(35, -hero.getBoundingClientRect().top * 0.08));
      hero.style.setProperty("--travel-shift", shift + "px");
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
    updateParallax();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".btn");
    if (!button) return;
    button.classList.remove("button-tap");
    void button.offsetWidth;
    button.classList.add("button-tap");
  });
})();