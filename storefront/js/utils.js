export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function on(target, event, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === "function") {
    target.addEventListener(event, selectorOrHandler);
    return;
  }
  const selector = selectorOrHandler;
  const handler = maybeHandler;
  target.addEventListener(event, (e) => {
    const match = e.target.closest(selector);
    if (match && target.contains(match)) handler(e, match);
  });
}

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** Reads/writes JSON to localStorage without throwing in private-browsing/storage-disabled contexts. */
export function storage(key) {
  return {
    get(fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable — app still works, just doesn't persist
      }
    },
  };
}

/** A tiny pub/sub used by the cart store and anything else that needs cross-component reactivity without a framework. */
export function createEmitter() {
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(payload) {
      for (const fn of listeners) fn(payload);
    },
  };
}

/** Traps Tab focus within a container — used by the cart drawer and mobile menu overlays. Returns a release function. */
export function trapFocus(container) {
  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  function handleKeydown(e) {
    if (e.key !== "Tab") return;
    const focusable = qsa(focusableSelector, container).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener("keydown", handleKeydown);
  return () => container.removeEventListener("keydown", handleKeydown);
}

/** Announces a message to screen readers via a shared aria-live region, without stealing visual focus. */
let liveRegion;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.className = "visually-hidden";
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = "";
  // Re-set on a new tick so repeated identical messages still fire.
  requestAnimationFrame(() => {
    liveRegion.textContent = message;
  });
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
