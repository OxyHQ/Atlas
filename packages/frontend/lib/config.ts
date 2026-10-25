/** Runtime configuration, read from `EXPO_PUBLIC_*` env vars (see `.env.example`). */

/** Backend API base URL. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';

/** The app's registered Oxy client id (ApplicationCredential publicKey). */
export const OXY_CLIENT_ID =
  process.env.EXPO_PUBLIC_OXY_CLIENT_ID ||
  'oxy_dk_b1440fd0ad132ffe6279f47d1d769bed92e6cfeb7dc4a7e1';
