import { qs, on } from "./utils.js";
import { listProducts } from "./data.js";
import { renderProductCard } from "./product-card.js";
import { initScrollReveal, initLoadReveal } from "./motion.js";
import { initNav } from "./nav.js";
import { initCartUI, celebrateAdd } from "./cart-ui.js";
import { addToCart } from "./cart-store.js";
import { initAnnouncementBar } from "./announcement.js";
import { initNewsletterForm } from "./newsletter.js";

async function renderFeatured() {
  const grid = qs("[data-featured-grid]");
  if (!grid) return;
  const products = await listProducts({ collectionHandle: "new-arrivals", first: 8 });
  grid.innerHTML = products.map(renderProductCard).join("");
  initScrollReveal(grid);

  on(grid, "click", "[data-quick-add]", async (e, btn) => {
    e.preventDefault();
    const product = products.find((p) => p.handle === btn.dataset.quickAdd);
    const variant = product?.variants.find((v) => v.available);
    if (!product || !variant) return;
    btn.disabled = true;
    btn.textContent = "Adding…";
    try {
      await addToCart({
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title,
        price: variant.price,
        image: product.featuredImage,
        handle: product.handle,
      });
      celebrateAdd(product.title);
    } finally {
      btn.disabled = false;
      btn.textContent = "Quick Add";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initCartUI();
  initAnnouncementBar();
  initNewsletterForm();
  initScrollReveal();
  initLoadReveal();
  renderFeatured();
});
