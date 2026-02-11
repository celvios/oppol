import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
    callbacks: {
        async signIn({ user, account }) {
            // Sync with backend to get/create custodial wallet
            try {
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
                    // Store wallet info for session
                    user.walletAddress = data.user.wallet_address;
                    user.userId = data.user.id;
                    return true;
                }

                return false;
            } catch (error) {
                console.error('Backend sync failed:', error);
                return false;
            }
        },
        async jwt({ token, user }) {
            // On initial sign in, add wallet data to token
            if (user) {
                token.walletAddress = user.walletAddress;
                token.userId = user.userId;
            }
            return token;
        },
        async session({ session, token }) {
            // Pass wallet data to session
            if (session.user) {
                session.user.address = token.walletAddress;
                session.user.id = token.userId;
            }
            return session;
        },
    },
});

export { handler as GET, handler as POST };
