import { qs, on, formatMoney, trapFocus, announce, prefersReducedMotion } from "./utils.js";
import { getSnapshot, subscribeCart, initCart, updateQuantity, removeFromCart } from "./cart-store.js";

let releaseFocusTrap;
let lastFocusedBeforeOpen;

function render(snapshot) {
  const root = qs("[data-cart-drawer]");
  if (!root) return;

  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = String(snapshot.itemCount);
    el.hidden = snapshot.itemCount === 0;
  });

  const itemsEl = qs("[data-cart-items]", root);
  const emptyEl = qs("[data-cart-empty]", root);
  const footEl = qs("[data-cart-footer]", root);

  if (snapshot.lines.length === 0) {
    itemsEl.innerHTML = "";
    emptyEl.hidden = false;
    footEl.hidden = true;
  } else {
    emptyEl.hidden = true;
    footEl.hidden = false;
    itemsEl.innerHTML = snapshot.lines
      .map(
        (line) => `
      <li class="cart-item" data-line-id="${line.lineId ?? line.variantId}">
        <div class="cart-item__media">
          ${line.image ? `<img src="${line.image.url}" alt="${line.image.altText ?? ""}" loading="lazy" width="72" height="72">` : ""}
        </div>
        <div class="cart-item__body">
          <p class="cart-item__title">${line.title}</p>
          ${line.variantTitle && line.variantTitle !== "Default Title" ? `<p class="cart-item__variant">${line.variantTitle}</p>` : ""}
          <div class="cart-item__row">
            <div class="qty-stepper" role="group" aria-label="Quantity">
              <button type="button" data-qty-decrease aria-label="Decrease quantity">−</button>
              <span aria-live="polite">${line.quantity}</span>
              <button type="button" data-qty-increase aria-label="Increase quantity">+</button>
            </div>
            <p class="cart-item__price">${formatMoney(line.price * line.quantity, snapshot.currency)}</p>
          </div>
          <button type="button" class="cart-item__remove" data-remove>Remove</button>
        </div>
      </li>`
      )
      .join("");
  }

  const fillEl = qs("[data-shipping-fill]", root);
  const msgEl = qs("[data-shipping-message]", root);
  if (fillEl) fillEl.style.width = `${snapshot.freeShippingProgress * 100}%`;
  if (msgEl) {
    msgEl.textContent =
      snapshot.freeShippingRemaining <= 0
        ? "Complimentary shipping unlocked ✨"
        : `You're ${formatMoney(snapshot.freeShippingRemaining, snapshot.currency)} from complimentary shipping ✨`;
  }

  const subtotalEl = qs("[data-cart-subtotal]", root);
  if (subtotalEl) subtotalEl.textContent = formatMoney(snapshot.subtotal, snapshot.currency);

  const checkoutBtn = qs("[data-checkout]", root);
  if (checkoutBtn) {
    checkoutBtn.disabled = snapshot.pending || snapshot.lines.length === 0;
    checkoutBtn.classList.toggle("is-loading", snapshot.pending);
  }
}

export function openCart() {
  const root = qs("[data-cart-drawer]");
  const overlay = qs("[data-overlay]");
  if (!root) return;
  lastFocusedBeforeOpen = document.activeElement;
  root.classList.add("is-open");
  overlay?.classList.add("is-open");
  root.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  releaseFocusTrap = trapFocus(root);
  qs("[data-cart-close]", root)?.focus();
}

export function closeCart() {
  const root = qs("[data-cart-drawer]");
  const overlay = qs("[data-overlay]");
  if (!root || !root.classList.contains("is-open")) return;
  root.classList.remove("is-open");
  overlay?.classList.remove("is-open");
  root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  releaseFocusTrap?.();
  (lastFocusedBeforeOpen ?? qs('[data-open-cart]'))?.focus();
}

export function initCartUI() {
  initCart();
  const root = qs("[data-cart-drawer]");
  if (!root) return;

  subscribeCart(render);
  render(getSnapshot());

  document.querySelectorAll("[data-open-cart]").forEach((btn) => btn.addEventListener("click", openCart));
  qs("[data-cart-close]", root)?.addEventListener("click", closeCart);
  qs("[data-overlay]")?.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-open")) closeCart();
  });

  on(root, "click", "[data-qty-increase]", (_e, btn) => {
    const li = btn.closest("[data-line-id]");
    const snapshot = getSnapshot();
    const line = snapshot.lines.find((l) => (l.lineId ?? l.variantId) === li.dataset.lineId);
    if (line) updateQuantity(li.dataset.lineId, line.quantity + 1);
  });
  on(root, "click", "[data-qty-decrease]", (_e, btn) => {
    const li = btn.closest("[data-line-id]");
    const snapshot = getSnapshot();
    const line = snapshot.lines.find((l) => (l.lineId ?? l.variantId) === li.dataset.lineId);
    if (line) updateQuantity(li.dataset.lineId, line.quantity - 1);
  });
  on(root, "click", "[data-remove]", (_e, btn) => {
    const li = btn.closest("[data-line-id]");
    removeFromCart(li.dataset.lineId);
  });

  qs("[data-checkout]", root)?.addEventListener("click", () => {
    const snapshot = getSnapshot();
    if (snapshot.isLive && snapshot.checkoutUrl) {
      window.location.href = snapshot.checkoutUrl;
    } else {
      announce("This is a preview cart — connect a live Shopify Storefront token to enable real checkout.");
      alert("Preview mode: checkout isn't connected yet. See storefront/README.md to go live.");
    }
  });
}

/** Called by product pages after a successful add-to-cart, for the confirmation moment. */
export function celebrateAdd(title) {
  announce(`${title} added to cart`);
  const badge = document.querySelector("[data-cart-count]");
  if (badge && !prefersReducedMotion()) {
    badge.classList.remove("bump");
    // eslint-disable-next-line no-unused-expressions
    void badge.offsetWidth; // restart animation
    badge.classList.add("bump");
  }
  openCart();
}
