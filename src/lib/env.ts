import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  // 32 raw bytes, base64. Lives outside Neon so a database leak yields ciphertext (SPEC §9).
  APP_ENCRYPTION_KEY: z.string().refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded',
  ),
});

type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

/**
 * Validated on first read, not at import. `next build` loads these modules while compiling, so
 * parsing eagerly would mean the image could only be built by someone holding production
 * secrets — and a missing variable would surface as a build failure rather than a clear
 * start-up error on the machine that is actually missing it.
 */
export const env = new Proxy({} as Env, {
  get(_target, key: string) {
    parsed ??= schema.parse(process.env);
    return parsed[key as keyof Env];
  },
});
