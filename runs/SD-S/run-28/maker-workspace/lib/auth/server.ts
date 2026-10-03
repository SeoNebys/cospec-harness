import { betterAuth } from "better-auth";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { sendPasswordReset } from "@/lib/mail";

const config = env();

export const auth = betterAuth({
  appName: "Lattice Bookmarks",
  baseURL: config.APP_BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: getDb(),
  trustedOrigins: [config.TRUSTED_ORIGIN, config.APP_BASE_URL, "http://maker:4000", "http://127.0.0.1:4000"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordReset(user.email, url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 20 },
      "/sign-up/email": { window: 60, max: 10 },
      "/request-password-reset": { window: 300, max: 10 },
    },
  },
  advanced: {
    cookiePrefix: "bookmark_manager",
    useSecureCookies: config.APP_BASE_URL.startsWith("https://"),
  },
});

export type Session = typeof auth.$Infer.Session;
