import { NextRequest, NextResponse } from 'next/server';

// Only the external label workspaces are gated. Internal market pages are unchanged.
const LABEL_PASSWORDS: Record<string, string | undefined> = {
  partisan: process.env.LABEL_PASSWORD_PARTISAN,
  futureclassic: process.env.LABEL_PASSWORD_FUTURECLASSIC,
  community: process.env.LABEL_PASSWORD_COMMUNITY,
};

async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const left = new Uint8Array(x);
  const right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}


async function sessionToken(label: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(label)));
  return label + '.' + Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
}

async function hasLabelSession(request: NextRequest, label: string): Promise<boolean> {
  const secret = LABEL_PASSWORDS[label];
  if (!secret) return false;
  const cookie = request.cookies.get('label_workspace')?.value ?? '';
  return sameSecret(cookie, await sessionToken(label, secret));
}

export async function middleware(request: NextRequest) {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const route = parts[0];
  const market = request.nextUrl.searchParams.get('market');
  const marketLabel = market?.startsWith('label-') ? market.slice(6) : null;
  const coachLabel = route === 'coach' && parts[1]?.includes('--label-')
    ? parts[1].split('--label-').at(-1) ?? null : null;

  // Keep label workspaces on the existing Basic Auth login.
  if (route === 'labels') {
    const label = parts[1];
    if (!label || !(label in LABEL_PASSWORDS)) return new NextResponse('Unknown label workspace', { status: 404 });
    const secret = LABEL_PASSWORDS[label];
    if (!secret) return new NextResponse('Label access is not configured.', { status: 503 });
    const auth = request.headers.get('authorization') ?? '';
    if (auth.startsWith('Basic ')) {
      try {
        const decoded = atob(auth.slice(6));
        const colon = decoded.indexOf(':');
        if (colon > -1 && decoded.slice(0, colon) === label &&
            await sameSecret(decoded.slice(colon + 1), secret)) {
          const response = NextResponse.next();
          response.headers.set('Cache-Control', 'private, no-store');
          response.cookies.set('label_workspace', await sessionToken(label, secret), {
            httpOnly: true, secure: request.nextUrl.protocol === 'https:',
            sameSite: 'lax', path: '/', maxAge: 28800,
          });
          return response;
        }
      } catch { /* malformed credentials */ }
    }
    return new NextResponse('Sign in to access this label dashboard.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="VMG Label Portal", charset="UTF-8"',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // Check workspace context on shared pages and market-scoped API reads.
  // Unscoped internal pages retain their existing behaviour until internal SSO exists.
  const scopedPage = route === 'watcher' || route === 'coach' ||
    route === 'campaigns' || route === 'growth';
  const scopedApi = request.nextUrl.pathname === '/api/active-campaigns';
  if (coachLabel && marketLabel !== coachLabel) {
    return new NextResponse('Workspace mismatch', { status: 403 });
  }
  if ((scopedPage || scopedApi) && marketLabel) {
    if (!(marketLabel in LABEL_PASSWORDS) || !await hasLabelSession(request, marketLabel)) {
      return new NextResponse('Label workspace session required', {
        status: 401, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/labels/:path*', '/coach/:path*', '/watcher/:path*', '/campaigns/:path*', '/growth/:path*', '/api/active-campaigns'],
};
