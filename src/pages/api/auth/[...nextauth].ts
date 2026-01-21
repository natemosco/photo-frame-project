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
      } else {
        // Preserve provider id across subsequent JWT calls
        token.googleId = token.googleId ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      const googleId = typeof token.googleId === "string" ? token.googleId : token.sub;
      // Include googleId in session.user.id for compatibility with getOrCreateUser
      if (session.user && googleId) {
        session.user.id = googleId;
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
