const allowedOrigins = [
  "http://localhost:3000",
  "https://programming-hero-assignment-10-clie.vercel.app",
];

const normalizedAllowedOrigins = [...new Set(allowedOrigins)];

export { normalizedAllowedOrigins };
