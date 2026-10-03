import { eq } from "drizzle-orm";
import { config } from "~/config.server";
import { db } from "~/db/client.server";
import { user } from "~/db/schema";
import { createAuth } from "./auth.server";

type ReviewUser = { name: string; email: string; password: string };

export const reviewUsers: ReviewUser[] = [
  { name: "Alice Rivera", email: config.REVIEW_USER_A_EMAIL, password: config.REVIEW_USER_A_PASSWORD },
  { name: "Bob Chen", email: config.REVIEW_USER_B_EMAIL, password: config.REVIEW_USER_B_PASSWORD },
];

export async function seedReviewUsers() {
  if (config.NODE_ENV === "production") throw new Error("Review users cannot be seeded in production.");
  const seedAuth = createAuth(db, true);
  for (const reviewUser of reviewUsers) {
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, reviewUser.email)).limit(1);
    if (existing.length > 0) continue;
    await seedAuth.api.signUpEmail({ body: reviewUser });
  }
  return reviewUsers;
}
