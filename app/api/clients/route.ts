import { listAccessibleClients } from '@/lib/db/repository';
import { getProfileView } from '@/components/features/user-profile/lib/profile';
import { NextResponse } from 'next/server';

export const revalidate = 0; // dynamic per request

export async function GET() {
  const profile = await getProfileView();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clients = await listAccessibleClients(profile);
  return NextResponse.json(clients);
}