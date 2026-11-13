import { randomBytes } from "node:crypto";
import { doubleCsrf } from "csrf-csrf";

export function createCsrfProtection({ production = false, secret = randomBytes(32).toString("hex") } = {}) {
  const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: req => req.cookies.campusfix_session || "anonymous",
    cookieName: production ? "__Host-campusfix-csrf" : "campusfix_csrf",
    cookieOptions: { httpOnly: true, secure: production, sameSite: "strict", path: "/" },
    getCsrfTokenFromRequest: req => req.get("X-CSRF-Token"),
  });

  function csrfProtection(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const submitted = req.get("X-CSRF-Token");
    // Require the explicit header as well as the cookie. The library then checks
    // its HMAC and binding to the current session (equality alone is not enough).
    const matchesCookie = production
      ? req.cookies["__Host-campusfix-csrf"] === submitted
      : req.cookies.campusfix_csrf === submitted;
    if (!submitted || !matchesCookie) return next(invalidCsrfTokenError);
    return doubleCsrfProtection(req, res, next);
  }

  return { generateCsrfToken, csrfProtection };
}
