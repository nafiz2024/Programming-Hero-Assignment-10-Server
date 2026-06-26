import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { trustedAuthOrigins } from "./cors.js";
import { client } from "./db.js";

const socialProviders = {};
const isSecureAuth = process.env.BETTER_AUTH_URL?.startsWith("https://");

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

const auth = betterAuth({
  database: mongodbAdapter(client.db(), {
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders,
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "user",
      },
      subscription: {
        type: "string",
        input: false,
        defaultValue: "free",
      },
      premiumUntil: {
        type: "date",
        input: false,
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              role: "user",
              subscription: "free",
              premiumUntil: null,
            },
          };
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: trustedAuthOrigins,
  advanced: {
    defaultCookieAttributes: {
      sameSite: isSecureAuth ? "none" : "lax",
      secure: isSecureAuth,
    },
  },
});

export { auth };
