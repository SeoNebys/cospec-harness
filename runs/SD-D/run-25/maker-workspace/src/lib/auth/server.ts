import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db/client";
import { authSchema } from "@/lib/db/auth-schema";
import { getEmailSender } from "@/lib/email";

const config = getConfig();

export const auth = betterAuth({
  appName: "Safekeep",
  baseURL: config.APP_BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [config.APP_BASE_URL, "http://maker:4000", "http://127.0.0.1:4000"],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: config.NODE_ENV === "production",
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 30 * 60,
    password: {
      hash: async (password) =>
        hash(password.normalize("NFC"), {
          memoryCost: 19 * 1024,
          timeCost: 2,
          parallelism: 1,
          outputLen: 32,
        }),
      verify: async ({ hash: digest, password }) => verify(digest, password.normalize("NFC")),
    },
    sendResetPassword: async ({ user, url }) => {
      await getEmailSender().send({
        to: user.email,
        subject: "Reset your Safekeep password",
        text: `Use this link within 30 minutes to reset your password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await getEmailSender().send({
        to: user.email,
        subject: "Verify your Safekeep account",
        text: `Verify your email address: ${url}`,
      });
    },
    sendOnSignUp: config.NODE_ENV === "production",
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: config.NODE_ENV === "production",
    cookiePrefix: "safekeep",
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
