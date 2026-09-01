import { qs, qsa, on } from "./utils.js";
import { listProducts, listCollections } from "./data.js";
import { renderProductCard } from "./product-card.js";
import { initScrollReveal } from "./motion.js";
import { initNav } from "./nav.js";
import { initCartUI, celebrateAdd } from "./cart-ui.js";
import { addToCart } from "./cart-store.js";
import { initAnnouncementBar } from "./announcement.js";
import { initNewsletterForm } from "./newsletter.js";

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    collection: params.get("collection") || null,
    sort: params.get("sort") || "featured",
    search: params.get("q") || "",
  };
}

function writeStateToUrl(state) {
  const params = new URLSearchParams();
  if (state.collection) params.set("collection", state.collection);
  if (state.sort && state.sort !== "featured") params.set("sort", state.sort);
  if (state.search) params.set("q", state.search);
  const query = params.toString();
  history.pushState(state, "", query ? `?${query}` : window.location.pathname);
}

let currentProducts = [];

async function renderGrid(state) {
  const grid = qs("[data-shop-grid]");
  const emptyState = qs("[data-shop-empty]");
  const countEl = qs("[data-shop-count]");
  grid.setAttribute("aria-busy", "true");

  currentProducts = await listProducts({ collectionHandle: state.collection, sort: state.sort, search: state.search, first: 60 });

  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = currentProducts.map(renderProductCard).join("");
  emptyState.hidden = currentProducts.length > 0;
  if (countEl) countEl.textContent = `${currentProducts.length} ${currentProducts.length === 1 ? "piece" : "pieces"}`;
  initScrollReveal(grid);
}

async function renderCollectionChips(state) {
  const container = qs("[data-collection-chips]");
  if (!container) return;
  const collections = await listCollections();
  container.innerHTML = [{ handle: "", title: "All" }, ...collections]
    .map(
      (c) =>
        `<button type="button" class="chip ${state.collection === (c.handle || null) ? "is-active" : ""}" data-collection="${c.handle}">${c.title}</button>`
    )
    .join("");
}

function syncControls(state) {
  const sortSelect = qs("[data-sort-select]");
  if (sortSelect) sortSelect.value = state.sort;
  const searchInput = qs("[data-shop-search]");
  if (searchInput) searchInput.value = state.search;
  qsa("[data-collection]").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.collection === (state.collection || "")));
}

async function applyState(state, { pushUrl = true } = {}) {
  if (pushUrl) writeStateToUrl(state);
  syncControls(state);
  await renderGrid(state);
}

function initControls() {
  let state = readStateFromUrl();

  qs("[data-sort-select]")?.addEventListener("change", (e) => {
    state = { ...state, sort: e.target.value };
    applyState(state);
  });

  let searchDebounce;
  qs("[data-shop-search]")?.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state = { ...state, search: e.target.value };
      applyState(state);
    }, 250);
  });

  on(document, "click", "[data-collection]", (_e, chip) => {
    state = { ...state, collection: chip.dataset.collection || null };
    applyState(state);
  });

  window.addEventListener("popstate", () => {
    state = readStateFromUrl();
    applyState(state, { pushUrl: false });
  });

  on(document, "click", "[data-quick-add]", async (e, btn) => {
    e.preventDefault();
    const product = currentProducts.find((p) => p.handle === btn.dataset.quickAdd);
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

  return state;
}

document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initCartUI();
  initAnnouncementBar();
  initNewsletterForm();
  const state = initControls();
  await renderCollectionChips(state);
  await applyState(state, { pushUrl: false });
});
