import { formatMoney } from "./utils.js";

/** Shared product-card markup used by the home and shop grids. */
export function renderProductCard(product) {
  const soldOut = product.variants.every((v) => !v.available);
  const priceLabel =
    product.priceRange.min === product.priceRange.max
      ? formatMoney(product.priceRange.min, product.priceRange.currency)
      : `From ${formatMoney(product.priceRange.min, product.priceRange.currency)}`;

  return `
    <article class="product-card reveal" data-product-card>
      <a href="product.html?handle=${product.handle}" class="product-card__link" aria-label="${product.title}">
        <div class="product-card__media">
          ${
            product.featuredImage
              ? `<img src="${product.featuredImage.url}" alt="${product.featuredImage.altText ?? product.title}" loading="lazy" width="600" height="600">`
              : `<div class="product-card__placeholder" aria-hidden="true"></div>`
          }
          ${soldOut ? `<span class="badge badge--muted">Sold Out</span>` : ""}
        </div>
        <div class="product-card__body">
          <h3 class="product-card__title">${product.title}</h3>
          <p class="product-card__price">${priceLabel}</p>
        </div>
      </a>
      <button type="button" class="product-card__quick-add" data-quick-add="${product.handle}" ${soldOut ? "disabled" : ""}>
        ${soldOut ? "Sold Out" : "Quick Add"}
      </button>
    </article>`;
}
