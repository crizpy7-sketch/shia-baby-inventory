// Code-usable counterpart to BRAND.md — keep the two in sync.
// Import these instead of hardcoding hex values (e.g. in email templates).

export const brand = {
  indigo: "#24345f",
  indigoDark: "#334a7c",
  cream: "#f7f1e8",
  paper: "#fffdf9",
  gold: "#b89b68",
  green: "#364f45",
  ink: "#1e2430",
  muted: "#6d7280",
  line: "#ded8cf",
  danger: "#a53232",
  ok: "#2c6d50",
  warn: "#a76b17",
} as const;

export const brandFonts = {
  display: "Georgia, 'Times New Roman', serif",
  body: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;
