import { qs, qsa, on, formatMoney, announce } from "./utils.js";
import { getProduct, listProducts } from "./data.js";
import { renderProductCard } from "./product-card.js";
import { initScrollReveal, initLoadReveal } from "./motion.js";
import { initNav } from "./nav.js";
import { initCartUI, celebrateAdd } from "./cart-ui.js";
import { addToCart } from "./cart-store.js";
import { initAnnouncementBar } from "./announcement.js";
import { initNewsletterForm } from "./newsletter.js";

function findVariant(product, selected) {
  return product.variants.find((v) => v.selectedOptions.every((opt) => selected[opt.name] === opt.value));
}

function renderGallery(product) {
  const images = product.images?.length ? product.images : [product.featuredImage].filter(Boolean);
  const main = qs("[data-gallery-main]");
  const thumbs = qs("[data-gallery-thumbs]");

  function show(index) {
    const image = images[index];
    main.innerHTML = image
      ? `<img src="${image.url}" alt="${image.altText ?? product.title}" width="900" height="900">`
      : `<div class="product-gallery__placeholder" aria-hidden="true"></div>`;
    qsa("[data-thumb]", thumbs).forEach((t, i) => t.classList.toggle("is-active", i === index));
  }

  thumbs.innerHTML = images
    .map((img, i) => `<button type="button" data-thumb data-index="${i}" aria-label="View image ${i + 1} of ${images.length}"><img src="${img.url}" alt="" loading="lazy" width="80" height="80"></button>`)
    .join("");
  thumbs.hidden = images.length <= 1;

  on(thumbs, "click", "[data-thumb]", (_e, btn) => show(Number(btn.dataset.index)));
  show(0);
}

function renderOptions(product, selected, onChange) {
  const container = qs("[data-product-options]");
  if (!product.options.length || (product.options.length === 1 && product.options[0].values.length === 1)) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = product.options
    .map(
      (opt) => `
    <fieldset class="option-group">
      <legend>${opt.name}</legend>
      <div class="option-values" role="radiogroup" aria-label="${opt.name}">
        ${opt.values
          .map((value) => {
            const variantForValue = product.variants.find((v) =>
              v.selectedOptions.some((so) => so.name === opt.name && so.value === value)
            );
            const disabled = variantForValue && !variantForValue.available;
            return `<button type="button"
              class="option-value ${selected[opt.name] === value ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"
              role="radio"
              aria-checked="${selected[opt.name] === value}"
              data-option-name="${opt.name}"
              data-option-value="${value}"
              ${disabled ? "aria-disabled=\"true\"" : ""}
            >${value}</button>`;
          })
          .join("")}
      </div>
    </fieldset>`
    )
    .join("");

  on(container, "click", "[data-option-name]", (_e, btn) => {
    if (btn.classList.contains("is-disabled")) return;
    onChange({ ...selected, [btn.dataset.optionName]: btn.dataset.optionValue });
  });
}

function renderPriceAndAvailability(variant, currency) {
  qs("[data-product-price]").textContent = formatMoney(variant.price, currency);
  const stickyPrice = qs("[data-product-price-sticky]");
  if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price, currency);
  const availabilityEl = qs("[data-product-availability]");
  if (variant.available) {
    const low = variant.quantityAvailable != null && variant.quantityAvailable <= 3;
    availabilityEl.textContent = low ? `Only ${variant.quantityAvailable} left` : "In stock";
    availabilityEl.classList.toggle("is-low", low);
    availabilityEl.classList.remove("is-out");
  } else {
    availabilityEl.textContent = "Sold out";
    availabilityEl.classList.add("is-out");
  }
  const addBtn = qs("[data-add-to-cart]");
  addBtn.disabled = !variant.available;
  addBtn.textContent = variant.available ? "Add to Cart" : "Sold Out";

  const stickyBtn = qs("[data-add-to-cart-sticky]");
  if (stickyBtn) {
    stickyBtn.disabled = !variant.available;
    stickyBtn.textContent = variant.available ? "Add to Cart" : "Sold Out";
  }
}

async function renderRelated(product) {
  const container = qs("[data-related-grid]");
  if (!container) return;
  const related = (await listProducts({ collectionHandle: undefined, first: 12 }))
    .filter((p) => p.handle !== product.handle && p.productType === product.productType)
    .slice(0, 4);
  if (related.length === 0) {
    container.closest("[data-related-section]").hidden = true;
    return;
  }
  container.innerHTML = related.map(renderProductCard).join("");
  initScrollReveal(container);
}

/**
 * Shows the sticky bar only once the real Add to Cart button has been
 * scrolled past *downward*, hides it once scrolled back above it. This is
 * deliberately not a plain "is the button on screen" check (e.g. via a bare
 * IntersectionObserver toggle) — that reads as symmetric in both
 * directions, which means it would also fire at page load (before the
 * visitor has scrolled to the button at all) and stay stuck open near the
 * top of the page. What should show the bar is specifically "scrolled past
 * it going down."
 */
function initStickyAddToCart() {
  const bar = qs("[data-sticky-add]");
  const trigger = qs("[data-add-to-cart]");
  if (!bar || !trigger) return;

  let ticking = false;
  function update() {
    const triggerBottom = trigger.getBoundingClientRect().bottom;
    bar.classList.toggle("is-visible", triggerBottom < 0);
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
  update();
}

async function main() {
  initNav();
  initCartUI();
  initAnnouncementBar();
  initNewsletterForm();

  const handle = new URLSearchParams(window.location.search).get("handle");
  const root = qs("[data-product-page]");
  const notFound = qs("[data-product-not-found]");

  if (!handle) {
    root.hidden = true;
    notFound.hidden = false;
    return;
  }

  const product = await getProduct(handle);
  if (!product) {
    root.hidden = true;
    notFound.hidden = false;
    return;
  }

  document.title = `${product.title} | Shia Baby`;
  qs("[data-product-title]").textContent = product.title;
  qs("[data-product-description]").innerHTML = product.description ? `<p>${product.description}</p>` : "";
  qs("[data-product-vendor]").textContent = product.vendor ?? "Shia Baby";

  renderGallery(product);
  initLoadReveal();

  let selected = { ...Object.fromEntries(product.variants[0].selectedOptions.map((o) => [o.name, o.value])) };
  let currentVariant = findVariant(product, selected) ?? product.variants[0];

  function update(nextSelected) {
    selected = nextSelected;
    currentVariant = findVariant(product, selected) ?? currentVariant;
    renderOptions(product, selected, update);
    renderPriceAndAvailability(currentVariant, product.priceRange.currency);
  }
  update(selected);

  const qtyInput = qs("[data-quantity-input]");
  qs("[data-quantity-decrease]").addEventListener("click", () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
  });
  qs("[data-quantity-increase]").addEventListener("click", () => {
    qtyInput.value = Number(qtyInput.value) + 1;
  });

  async function handleAddToCart() {
    const buttons = [qs("[data-add-to-cart]"), qs("[data-add-to-cart-sticky]")].filter(Boolean);
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = "Adding…";
    });
    try {
      await addToCart({
        variantId: currentVariant.id,
        quantity: Number(qtyInput.value) || 1,
        title: product.title,
        variantTitle: currentVariant.title,
        price: currentVariant.price,
        image: product.featuredImage,
        handle: product.handle,
      });
      celebrateAdd(product.title);
    } catch (err) {
      announce("Something went wrong adding this to your cart. Please try again.");
      console.error(err);
    } finally {
      renderPriceAndAvailability(currentVariant, product.priceRange.currency);
    }
  }

  qs("[data-add-to-cart]").addEventListener("click", handleAddToCart);
  qs("[data-sticky-add] [data-add-to-cart-sticky]")?.addEventListener("click", handleAddToCart);

  initStickyAddToCart();
  await renderRelated(product);
  initScrollReveal();
}

document.addEventListener("DOMContentLoaded", main);
