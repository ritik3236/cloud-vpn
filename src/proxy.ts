import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Next 16 renamed `middleware` to `proxy`; the runtime is nodejs and is not configurable.
const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/health']);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|css|js)).*)', '/(api|trpc)(.*)'],
};
