import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

console.log("NextAuth App Router Handler Loaded");

const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    debug: true,
    callbacks: {
        async signIn({ user, account, profile }) {
            try {
                // Modified to use /api/users/sync-google to avoid NextAuth route conflict
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync-google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        googleId: account?.providerAccountId,
                        name: user.name,
                        avatar: user.image
                    })
                });

                const data = await res.json();

                if (data.success && data.user) {
                    (user as any).wallet_address = data.user.wallet_address;
                    (user as any).id = data.user.id;
                    return true;
                }

                return false;
            } catch (error) {
                console.error('Backend Auth Sync Failed:', error);
                return false;
            }
        },
        async session({ session, token, user }) {
            if (token) {
                // @ts-ignore
                session.user.address = token.wallet_address;
                // @ts-ignore
                session.user.id = token.id;
            }
            return session;
        },
        async jwt({ token, user, account }) {
            if (user) {
                // @ts-ignore
                token.wallet_address = (user as any).wallet_address;
                // @ts-ignore
                token.id = (user as any).id;
            }
            return token;
        }
    }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export const dynamic = 'force-dynamic';
