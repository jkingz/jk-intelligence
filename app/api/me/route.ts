import { getProfileView } from '@/components/features/user-profile/lib/profile';
import { NextResponse } from 'next/server';

export const revalidate = 0; // always fetch fresh per request (user-specific)

export async function GET() {
  const profile = await getProfileView();
  return NextResponse.json(profile);
}