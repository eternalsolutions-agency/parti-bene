(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    document.documentElement.classList.add("reduced-motion");
    return;
  }

  document.documentElement.classList.add("motion-enabled");

  const revealTargets = document.querySelectorAll(
    "main section > .container, .card, .path, .panel, .category, .offer-card, .step"
  );
  revealTargets.forEach((element, index) => {
    element.classList.add("reveal-item");
    element.style.setProperty("--reveal-delay", Math.min(index % 6, 5) * 55 + "ms");
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -35px" });

  revealTargets.forEach((element) => observer.observe(element));

  const hero = document.querySelector(".hero");
  if (hero && window.matchMedia("(min-width: 901px)").matches) {
    let ticking = false;
    const updateParallax = () => {
      const rect = hero.getBoundingClientRect();
      const shift = Math.max(-35, Math.min(35, -rect.top * 0.08));
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