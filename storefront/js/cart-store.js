import { config } from "./config.js";
import { storage, createEmitter } from "./utils.js";
import { shopifyCartCreate, shopifyCartLinesAdd, shopifyCartLinesUpdate, shopifyCartLinesRemove } from "./data.js";

const cartIdStore = storage("shia-baby-cart-id");
const mockCartStore = storage("shia-baby-mock-cart");

const emitter = createEmitter();

/** @type {{ id: string|null, checkoutUrl: string|null, lines: Array, subtotal: number, total: number, currency: string }} */
let state = { id: null, checkoutUrl: null, lines: [], subtotal: 0, total: 0, currency: config.currency };
let pending = false;

function withMockTotals(next) {
  next.subtotal = next.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  next.total = next.subtotal;
  next.currency = config.currency;
  return next;
}

function setState(next) {
  state = next;
  if (!config.isLive) mockCartStore.set(state);
  emitter.emit(getSnapshot());
}

export function getSnapshot() {
  return {
    ...state,
    itemCount: state.lines.reduce((n, l) => n + l.quantity, 0),
    pending,
    isLive: config.isLive,
    freeShippingRemaining: Math.max(0, config.freeShippingThresholdCents / 100 - state.subtotal),
    freeShippingProgress: Math.min(1, state.subtotal / (config.freeShippingThresholdCents / 100)),
  };
}

export function subscribeCart(fn) {
  return emitter.subscribe(fn);
}

/** Restores persisted cart state on page load. Call once, before rendering the cart UI. */
export function initCart() {
  if (!config.isLive) {
    const saved = mockCartStore.get();
    if (saved) state = saved;
  }
  // Live-mode cart is re-fetched lazily on first mutation using the saved
  // cart id (Storefront API has no bare "get cart by id" convenience here
  // beyond re-running a cartLinesAdd([]) style no-op, so we simply start
  // fresh visually and let the first real action reconcile with Shopify).
  emitter.emit(getSnapshot());
}

async function withPending(fn) {
  pending = true;
  emitter.emit(getSnapshot());
  try {
    return await fn();
  } finally {
    pending = false;
  }
}

export async function addToCart({ variantId, quantity = 1, title, variantTitle, price, image, handle }) {
  return withPending(async () => {
    if (config.isLive) {
      const cart = state.id
        ? await shopifyCartLinesAdd(state.id, [{ merchandiseId: variantId, quantity }])
        : await shopifyCartCreate([{ merchandiseId: variantId, quantity }]);
      cartIdStore.set(cart.id);
      setState(cart);
      return;
    }

    const existing = state.lines.find((l) => l.variantId === variantId);
    const lines = existing
      ? state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
      : [...state.lines, { variantId, quantity, title, variantTitle, price, image, handle }];
    setState(withMockTotals({ ...state, lines }));
  });
}

export async function updateQuantity(variantIdOrLineId, quantity) {
  return withPending(async () => {
    if (config.isLive) {
      const cart = await shopifyCartLinesUpdate(state.id, [{ id: variantIdOrLineId, quantity }]);
      setState(cart);
      return;
    }
    const lines = state.lines
      .map((l) => (l.variantId === variantIdOrLineId ? { ...l, quantity } : l))
      .filter((l) => l.quantity > 0);
    setState(withMockTotals({ ...state, lines }));
  });
}

export async function removeFromCart(variantIdOrLineId) {
  return withPending(async () => {
    if (config.isLive) {
      const cart = await shopifyCartLinesRemove(state.id, [variantIdOrLineId]);
      setState(cart);
      return;
    }
    const lines = state.lines.filter((l) => l.variantId !== variantIdOrLineId);
    setState(withMockTotals({ ...state, lines }));
  });
}
