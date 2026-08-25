import { jwtVerify, SignJWT } from "jose";
import { logNativeRequestProbe } from "./logNativeRequestProbe";
 
 const encoder = new TextEncoder();
 const secret = process.env.JWT_SECRET;

export const SessionExpirationSeconds = 60 * 60 * 24 * 7; // 1 week
// Probability to run cleanup (10%)
export const CleanupProbability = 0.1;

// Only send the ID in the cookie to the client
// We should store id -> user id and user data mapping in our database for max security
export interface Session {
  // this should be a crypto random string
  id: string;
  createdAt: number;
  lastAccessed: number;

  // Whether the user needs to change their password
  // Useful for password reset or setting up new user with initial password
  passwordChangeRequired?: boolean;
}

const CookieName = "floot_built_app_session";

export class NotAuthenticatedError extends Error {
  constructor(message?: string) {
    super(message ?? "Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Creates and returns a signed session JWT from a Session object.
 * Uses the same payload, HS256 algorithm, and 1-day expiration as setServerSession.
 */
export async function createSessionToken(session: Session): Promise<string> {
  return await new SignJWT({
    id: session.id,
    createdAt: session.createdAt,
    lastAccessed: session.lastAccessed,
    passwordChangeRequired: session.passwordChangeRequired,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(encoder.encode(secret));
}

/**
 * Returns the user session or throw an error. Make sure to handle the error (return a proper request)
 */
export async function getServerSessionOrThrow(
  request: Request
): Promise<Session> {
  // Note: if session is valid, also consider making the cookie rolling by using setSession

  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader
    .split(";")
    .reduce((cookies: Record<string, string>, cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
      return cookies;
    }, {});
   const sessionCookie = cookies[CookieName];
 
   if (!sessionCookie) {
    // Fall back to Authorization header for native mobile clients
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7).trim();
      if (bearerToken) {
        try {
          const { payload } = await jwtVerify(bearerToken, encoder.encode(secret));
          logNativeRequestProbe(request, "auth-session-check", { outcome: "ok-bearer" });
          return {
            id: payload.id as string,
            createdAt: payload.createdAt as number,
            lastAccessed: payload.lastAccessed as number,
            passwordChangeRequired: payload.passwordChangeRequired as boolean,
          };
        } catch (error) {
          logNativeRequestProbe(request, "auth-session-check", { outcome: "jwt-invalid" });
          throw new NotAuthenticatedError();
        }
      }
    }
    // TEMPORARY DIAGNOSTIC: Probe native app requests
    logNativeRequestProbe(request, "auth-session-check", { outcome: "no-cookie" });
     throw new NotAuthenticatedError();
   }
   try {
    const { payload } = await jwtVerify(sessionCookie, encoder.encode(secret));
    // TEMPORARY DIAGNOSTIC: Probe native app requests
    logNativeRequestProbe(request, "auth-session-check", { outcome: "ok-cookie" });
    return {
      id: payload.id as string,
      createdAt: payload.createdAt as number,
      lastAccessed: payload.lastAccessed as number,
      passwordChangeRequired: payload.passwordChangeRequired as boolean,
     };
   } catch (error) {
     // TEMPORARY DIAGNOSTIC: Probe native app requests
    logNativeRequestProbe(request, "auth-session-check", { outcome: "jwt-invalid" });
    throw new NotAuthenticatedError();
  }
 }

export async function setServerSession(
  response: Response,
  session: Session
): Promise<void> {
  const token = await createSessionToken(session);

  const cookieValue = [
    `${CookieName}=${token}`,
    "HttpOnly",
    "Secure",
        "SameSite=None",
    "Path=/",
    `Max-Age=${SessionExpirationSeconds}`,
  ].join("; ");

  response.headers.set("Set-Cookie", cookieValue);
}

export function clearServerSession(response: Response) {
  // Clear the session cookie by setting an expired date
  const cookieValue = [
    `${CookieName}=`,
    "HttpOnly",
    "Secure",
        "SameSite=None",
    "Path=/",
    "Max-Age=0", // Expire immediately
  ].join("; ");

  response.headers.set("Set-Cookie", cookieValue);
}