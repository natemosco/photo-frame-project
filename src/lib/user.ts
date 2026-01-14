import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import type { User as NextAuthUser, Account as NextAuthAccount } from "next-auth";

/**
 * Sync user from NextAuth callback data to database.
 * Used in NextAuth jwt callback to sync user on sign-in.
 */
export async function syncUserFromProvider(
  user: NextAuthUser,
  account: NextAuthAccount | null
): Promise<string> {
  if (!user.email || !account?.providerAccountId) {
    throw new Error("Missing required user data for sync");
  }

  const googleId = account.providerAccountId;
  const email = user.email;
  const name = user.name ?? null;
  const image = user.image ?? null;

  // Try to find existing user by googleId
  const existingUser = await db.query.users.findFirst({
    where: eq(users.googleId, googleId),
  });

  if (existingUser) {
    // Update user data if it has changed
    if (
      existingUser.email !== email ||
      existingUser.name !== name ||
      existingUser.image !== image
    ) {
      await db
        .update(users)
        .set({
          email,
          name,
          image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }
    return existingUser.id;
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      googleId,
      name,
      image,
    })
    .returning({ id: users.id });

  return newUser.id;
}

/**
 * Get or create a user from Auth.js session data.
 * Syncs user data (email, name, image, googleId) on first login or updates on subsequent logins.
 */
export async function getOrCreateUser(session: Session): Promise<string> {
  if (!session.user?.email || !session.user?.id) {
    throw new Error("Session missing required user data");
  }

  const googleId = session.user.id;
  const email = session.user.email;
  const name = session.user.name ?? null;
  const image = session.user.image ?? null;

  // Try to find existing user by googleId
  const existingUser = await db.query.users.findFirst({
    where: eq(users.googleId, googleId),
  });

  if (existingUser) {
    // Update user data if it has changed
    if (
      existingUser.email !== email ||
      existingUser.name !== name ||
      existingUser.image !== image
    ) {
      await db
        .update(users)
        .set({
          email,
          name,
          image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }
    return existingUser.id;
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      googleId,
      name,
      image,
    })
    .returning({ id: users.id });

  return newUser.id;
}
