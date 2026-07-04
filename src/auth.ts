import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import getMongoClient from "@/lib/mongodb";

const credentialsProvider = Credentials({
  name: "Credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = credentials?.email?.toString().trim().toLowerCase();
    const password = credentials?.password?.toString() ?? "";

    if (!email || !password) {
      return null;
    }

    const client = await getMongoClient();
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne<{
        _id: unknown;
        name?: string;
        email?: string;
        image?: string;
        passwordHash?: string;
      }>({ email });

    if (!user?.passwordHash) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return {
      id: String(user._id),
      name: user.name ?? email,
      email: user.email ?? email,
      image: user.image ?? null,
    };
  },
});

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: process.env.MONGODB_URI
    ? MongoDBAdapter(getMongoClient())
    : undefined,
  secret: process.env.AUTH_SECRET,
  providers: googleProvider
    ? [credentialsProvider, googleProvider]
    : [credentialsProvider],
});
