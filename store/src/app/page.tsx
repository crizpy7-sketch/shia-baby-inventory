// Placeholder only — the real storefront UI is being built separately.
// This route exists so the Next.js app has something to render at "/";
// every actual feature lives under /api/*. See README.md for the route list.
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontFamily: "Georgia, serif", color: "var(--indigo)" }}>Shia Baby — Store API</h1>
      <p style={{ color: "var(--muted)" }}>
        This is the backend for the Shia Baby storefront. It has no UI of its own — see{" "}
        <code>README.md</code> for the full API route list.
      </p>
    </main>
  );
}
