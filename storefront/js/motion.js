import { prefersReducedMotion } from "./utils.js";

/**
 * Fades/rises any [data-reveal] or .reveal element into view once it
 * crosses the viewport threshold. Call again after injecting new DOM
 * (e.g. after a grid re-render) — already-observed elements are skipped.
 */
let observer;
export function initScrollReveal(root = document) {
  if (prefersReducedMotion()) {
    root.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }
  root.querySelectorAll(".reveal:not(.in)").forEach((el) => observer.observe(el));
}

// Note on page-to-page transitions: cross-document View Transitions (the
// browser cross-fading between full page navigations) are opted into
// entirely via CSS — `@view-transition { navigation: auto; }` in app.css —
// with no JS involved. Supporting browsers animate automatically; others
// just navigate normally. There's nothing to call from here.
