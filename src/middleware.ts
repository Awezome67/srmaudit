import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // admin-only
    if (pathname.startsWith("/admin")) {
      const role = (req.nextauth.token as any)?.role;
      if (role !== "ADMIN") {
        return NextResponse.redirect(new URL("/assets", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // protect /assets and /admin
        if (pathname.startsWith("/assets") || pathname.startsWith("/admin")) {
          return !!token; // harus login
        }

        return true; // route lain bebas
      },
    },
  }
);

export const config = {
  matcher: ["/assets/:path*", "/admin/:path*"],
};