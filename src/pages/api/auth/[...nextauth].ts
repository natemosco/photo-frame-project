import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { syncUserFromProvider } from "../../../lib/user";

export const authOptions: NextAuthOptions = {
  debug: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Sync user to database on sign-in
      if (user && account) {
        try {
          const userId = await syncUserFromProvider(user, account);
          token.userId = userId;
          token.googleId = account.providerAccountId;
        } catch (error) {
          console.error("Failed to sync user to database:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Include googleId in session.user.id for compatibility with getOrCreateUser
      if (session.user && token.googleId && typeof token.googleId === "string") {
        session.user.id = token.googleId;
      }
      // Optionally include database userId in session
      if (token.userId && typeof token.userId === "string") {
        session.userId = token.userId;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
