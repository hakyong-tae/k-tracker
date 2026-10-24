import type { Env } from './env.ts';

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function makeSession(env: Env): Promise<string> {
  const exp = Date.now() + 7 * 86400000;
  return `${exp}.${await hmac(env.ADMIN_PASSWORD!, `admin:${exp}`)}`;
}

export async function isAdmin(req: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (req.headers.get('cookie') ?? '').match(/(?:^|;\s*)kt_admin=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = await hmac(env.ADMIN_PASSWORD, `admin:${exp}`);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function passwordOk(env: Env, given: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const [a, b] = await Promise.all([hmac('pw', given), hmac('pw', env.ADMIN_PASSWORD)]);
  return a === b;
}

export async function ipHash(req: Request): Promise<string> {
  const ip = req.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  return (await hmac('ip-salt-v1', ip)).slice(0, 16);
}
