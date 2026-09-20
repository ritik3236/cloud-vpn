import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  // 32 raw bytes, base64. Lives outside Neon so a database leak yields ciphertext (SPEC §9).
  APP_ENCRYPTION_KEY: z.string().refine(
    (v) => Buffer.from(v, 'base64').length === 32,
    'APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded',
  ),
});

export const env = schema.parse(process.env);
