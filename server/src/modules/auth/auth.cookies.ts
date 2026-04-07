import type { Response } from "express";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  // On localhost, ports differ but the "site" is still localhost, so Lax works well for fetch+credentials.
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
}