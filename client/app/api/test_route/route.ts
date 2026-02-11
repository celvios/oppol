
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        message: 'API Routing is working',
        env: {
            nextAuthUrl: process.env.NEXTAUTH_URL,
            hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
            hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET
        }
    });
}
