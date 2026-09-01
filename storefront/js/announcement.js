const MESSAGES = [
  "Complimentary Shipping on Orders Over $75",
  "Every Order Arrives Beautifully Gift-Wrapped",
  "Now Shipping From the Mercado District",
];

export function initAnnouncementBar() {
  const el = document.querySelector("[data-announcement-text]");
  if (!el) return;
  let index = 0;
  setInterval(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      index = (index + 1) % MESSAGES.length;
      el.textContent = MESSAGES[index];
      el.style.opacity = "1";
    }, 400);
  }, 4500);
}
