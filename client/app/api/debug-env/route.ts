import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasApiUrl: !!process.env.NEXT_PUBLIC_API_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL || 'NOT_SET',
        // Only show first 4 chars of secrets for security
        googleClientIdPreview: process.env.GOOGLE_CLIENT_ID?.substring(0, 4) || 'NOT_SET',
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'NOT_SET',
    });
}
