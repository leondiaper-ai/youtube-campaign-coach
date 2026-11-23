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

export async function middleware(request: NextRequest) {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const label = parts[1];
  if (parts[0] === 'coach' && parts[1]?.includes('--label-')) {
    const slugLabel = parts[1].split('--label-').at(-1) ?? '';
    if (request.nextUrl.searchParams.get('market') !== 'label-' + slugLabel || !(slugLabel in LABEL_PASSWORDS)) return new NextResponse('Workspace mismatch', { status: 403 });
    const secret = LABEL_PASSWORDS[slugLabel];
    const cookie = request.cookies.get('label_workspace')?.value ?? '';
    if (!secret || !await sameSecret(cookie, await sessionToken(slugLabel, secret))) return new NextResponse('Label session required', { status: 401 });
    return NextResponse.next();
  }
  if (!label || !(label in LABEL_PASSWORDS)) return NextResponse.next();

  const secret = LABEL_PASSWORDS[label];
  if (!secret) return new NextResponse('Label access is not configured.', { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(':');
      if (colon > -1) {
        const username = decoded.slice(0, colon);
        const password = decoded.slice(colon + 1);
        if (username === label && await sameSecret(password, secret)) {
          const response = NextResponse.next();
          response.headers.set('Cache-Control', 'private, no-store');
          response.cookies.set('label_workspace', await sessionToken(label, secret), { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 28800 });
          return response;
        }
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

export const config = {
  matcher: ['/labels/:path*', '/coach/:path*'],
};
