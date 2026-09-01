import { qs, qsa, on, debounce, formatMoney, trapFocus } from "./utils.js";
import { listProducts } from "./data.js";

export function initNav() {
  initMobileMenu();
  initStickyHeader();
  initSearch();
  const yearEl = qs("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function initMobileMenu() {
  const toggle = qs("[data-menu-toggle]");
  const menu = qs("[data-mobile-menu]");
  if (!toggle || !menu) return;

  let release;
  function open() {
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll");
    release = trapFocus(menu);
  }
  function close() {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
    release?.();
    toggle.focus();
  }

  toggle.addEventListener("click", () => (menu.classList.contains("is-open") ? close() : open()));
  qs("[data-menu-close]", menu)?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) close();
  });
  qsa("a", menu).forEach((link) => link.addEventListener("click", close));
}

function initStickyHeader() {
  const header = qs("[data-site-header]");
  if (!header) return;
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 8);
    // Hide on scroll-down past the hero, reveal on scroll-up — common
    // pattern for reclaiming vertical space on mobile without losing nav.
    if (y > 240 && y > lastY) header.classList.add("is-hidden");
    else header.classList.remove("is-hidden");
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
}

function initSearch() {
  const trigger = qs("[data-search-toggle]");
  const overlay = qs("[data-search-overlay]");
  if (!trigger || !overlay) return;
  const input = qs("[data-search-input]", overlay);
  const results = qs("[data-search-results]", overlay);
  const emptyState = qs("[data-search-empty]", overlay);

  let release;
  function open() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    release = trapFocus(overlay);
    input.value = "";
    results.innerHTML = "";
    emptyState.hidden = true;
    requestAnimationFrame(() => input.focus());
  }
  function close() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    release?.();
    trigger.focus();
  }

  trigger.addEventListener("click", open);
  qs("[data-search-close]", overlay)?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    if (e.key === "/" && !overlay.classList.contains("is-open") && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      open();
    }
  });

  const runSearch = debounce(async (term) => {
    if (!term.trim()) {
      results.innerHTML = "";
      emptyState.hidden = true;
      return;
    }
    const products = await listProducts({ search: term, first: 8 });
    emptyState.hidden = products.length > 0;
    results.innerHTML = products
      .map(
        (p) => `
      <li>
        <a href="product.html?handle=${p.handle}" class="search-result">
          ${p.featuredImage ? `<img src="${p.featuredImage.url}" alt="" loading="lazy" width="56" height="56">` : ""}
          <span>
            <span class="search-result__title">${p.title}</span>
            <span class="search-result__price">${formatMoney(p.priceRange.min, p.priceRange.currency)}</span>
          </span>
        </a>
      </li>`
      )
      .join("");
  }, 220);

  input.addEventListener("input", (e) => runSearch(e.target.value));

  // Basic roving keyboard nav through results (Up/Down/Enter).
  overlay.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
    const links = qsa("a", results);
    if (links.length === 0) return;
    const currentIndex = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (links[currentIndex + 1] ?? links[0]).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (links[currentIndex - 1] ?? links[links.length - 1]).focus();
    }
  });
}
