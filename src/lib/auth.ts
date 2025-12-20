import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateUser } from "./password-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Required for Vercel deployment - trusts x-forwarded-host header
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Auth.js authorize called with:", {
          email: credentials?.email,
        });

        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        try {
          const user = await authenticateUser(
            credentials.email as string,
            credentials.password as string
          );

          console.log("Authenticate user result:", {
            user: user
              ? { id: user.id, email: user.email, is_admin: user.is_admin }
              : null,
          });

          if (!user) {
            console.log("No user found or invalid password");
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.is_admin,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
});
