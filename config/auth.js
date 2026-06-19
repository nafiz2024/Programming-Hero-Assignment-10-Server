import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { client } from "./db.js";

const auth = betterAuth({
  database: mongodbAdapter(client.db(), {
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
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
  trustedOrigins: [process.env.CLIENT_URL],
});

export { auth };
