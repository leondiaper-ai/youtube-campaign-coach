// This debug endpoint has been removed.
// The release cluster detection is now verified and running in production.
export const dynamic = 'force-dynamic';
export async function GET() {
  return new Response('Debug endpoint removed', { status: 410 });
}
