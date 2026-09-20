import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Session hydration only — deliberately no path-based protection.
 *
 * Clerk deprecated `createRouteMatcher` because middleware path matching can diverge from
 * how Next actually routes a request, leaving protected resources reachable. SPEC §2 requires
 * the check to run on every call, so authorization is resource-based: each page, route handler
 * and server function that touches protected data calls `requireRole()` itself.
 */
export const proxy = clerkMiddleware();

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|css|js)).*)', '/(api|trpc)(.*)'],
};
