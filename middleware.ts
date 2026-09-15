import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  if (await isAuthToken(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

/* Everything is behind the gate — unlike ClientProgram, no page here is public.
   The matcher excludes Next's own asset routes and the favicon only. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
