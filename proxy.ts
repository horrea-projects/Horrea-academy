import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/admin(.*)",
  "/api/progress(.*)",
  "/api/categories(.*)",
  "/api/courses(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Inclure "/" pour que Clerk détecte le proxy (auth() sur app/page.tsx).
  // Protéger le dashboard et les routes d'admin.
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/api/admin/:path*", "/api/progress", "/api/progress/:path*", "/api/categories", "/api/categories/:path*", "/api/courses", "/api/courses/:path*"],
};
