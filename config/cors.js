const defaultClientOrigins = [
  "http://localhost:3000",
  "https://programming-hero-assignment-10-clie.vercel.app",
];

function normalizeOrigin(origin) {
  return typeof origin === "string" ? origin.trim().replace(/\/$/, "") : "";
}

const normalizedAllowedOrigins = [...new Set([
  ...defaultClientOrigins,
  process.env.CLIENT_URL,
].map(normalizeOrigin).filter(Boolean))];

const trustedAuthOrigins = [...new Set([
  ...normalizedAllowedOrigins,
  process.env.BETTER_AUTH_URL,
].map(normalizeOrigin).filter(Boolean))];

export { normalizedAllowedOrigins, trustedAuthOrigins };
