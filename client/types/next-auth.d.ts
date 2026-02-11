import NextAuth from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** The user's postal address. */
            address: string // Wallet Address
            id: string // User UUID
            name?: string | null
            email?: string | null
            image?: string | null
        }
    }
}
