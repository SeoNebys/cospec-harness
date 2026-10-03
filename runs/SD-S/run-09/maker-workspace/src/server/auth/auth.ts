import type { AppDatabase } from "../db/client.js";
import type { AppConfig } from "../config.js";
import type { Mailer } from "../mail/mailer.js";
import { betterAuth } from "better-auth";

export function createAuth(db: AppDatabase, config: AppConfig, mailer: Mailer) {
  return betterAuth({
    appName: "Keep",
    database: db,
    baseURL: config.authBaseUrl,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: [...new Set([...config.trustedOrigins, config.appOrigin, new URL(config.authBaseUrl).origin])],
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.sendPasswordReset({ to: user.email, resetUrl: url });
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false }
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: config.nodeEnv === "production" ? 30 : 10_000,
      customRules: {
        "/sign-in/email": { window: 60, max: config.nodeEnv === "production" ? 8 : 100 },
        "/request-password-reset": { window: 300, max: config.nodeEnv === "production" ? 5 : 100 }
      }
    },
    advanced: {
      useSecureCookies: config.nodeEnv === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
        path: "/"
      }
    }
  });
}

export type Auth = ReturnType<typeof createAuth>;
