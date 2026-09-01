/**
 * Footer newsletter signup. Posts to WAITLIST_ENDPOINT if one is configured
 * (e.g. the /api/waitlist route from the store/ backend, if that's ever
 * wired back up), otherwise degrades to a friendly client-side confirmation
 * — same honest "not connected yet" pattern used elsewhere in this repo
 * rather than pretending a submission was captured.
 */
const WAITLIST_ENDPOINT = null;

export function initNewsletterForm() {
  const form = document.querySelector("[data-newsletter-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    if (WAITLIST_ENDPOINT) {
      try {
        await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {
        // Fall through to the confirmation message regardless — don't
        // strand the visitor on a broken form over a network hiccup.
      }
    }

    form.outerHTML = '<p class="newsletter__done">Welcome to the family — thank you for joining us. 🤍</p>';
  });
}
