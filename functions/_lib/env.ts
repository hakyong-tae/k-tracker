export interface Env {
  DB: D1Database;
  GPX: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  SITE_URL?: string;
  ADSENSE_CLIENT?: string;
  AGODA_CID?: string;
  /** Browser keys (referrer-restricted), so safe to ship in HTML */
  KAKAO_JS_KEY?: string;
  GOOGLE_MAPS_KEY?: string;
}
export type Ctx = EventContext<Env, string, Record<string, unknown>>;
