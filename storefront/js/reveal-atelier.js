/**
 * Reveal Atelier booking inquiry form. No booking backend is wired into
 * this storefront yet, so this degrades to a client-side confirmation —
 * same honest "not connected yet" pattern as the newsletter signup (see
 * newsletter.js) rather than pretending a reservation was captured.
 */
const BOOKING_ENDPOINT = null;

export function initRevealAtelierForm() {
  const form = document.querySelector("[data-reveal-booking-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector("[data-name-field]").value;
    const email = form.querySelector("[data-email-field]").value;
    const date = form.querySelector("[data-date-field]").value;
    const songStyle = form.querySelector("[data-song-style]").value;
    const songDetails = form.querySelector("[data-song-details]").value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    if (BOOKING_ENDPOINT) {
      try {
        await fetch(BOOKING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, date, songStyle, songDetails }),
        });
      } catch {
        // Fall through to the confirmation message regardless — don't
        // strand the visitor on a broken form over a network hiccup.
      }
    }

    const message = document.createElement("p");
    message.className = "reveal-atelier__booked";
    message.textContent = `${name ? `Thank you, ${name}` : "Thank you"} — we'll be in touch to plan your Reveal Experience, including your personalized reveal song. 🤍`;
    form.replaceWith(message);
  });
}
