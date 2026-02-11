import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // console.log('Google Login Attempt:', user.email);

            // Sync with Backend
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`, {
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
                    // Attach backend data to user object for session callback
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
            // Pass properties from token/user to session
            if (token) {
                // @ts-ignore
                session.user.address = token.wallet_address;
                // @ts-ignore
                session.user.id = token.id;
            }
            return session;
        },
        async jwt({ token, user, account }) {
            // Initial sign in
            if (user) {
                // @ts-ignore
                token.wallet_address = (user as any).wallet_address;
                // @ts-ignore
                token.id = (user as any).id;
            }
            return token;
        }
    },
    pages: {
        // signIn: '/auth/signin', // Custom sign-in page if needed
    }
});

export { handler as GET, handler as POST };
