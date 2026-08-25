# Native App API Error Investigation & Mitigation

**Symptom Pattern**
Login and public endpoints succeed, but every authenticated endpoint returns 401. As a result, the UI appears logged in, but session-dependent data (wallet/Guthaben balance, admin tab contents, profile details) renders completely empty.

**Proven Root Cause**
Production logs (via `native-probe`) confirm that requests from the iOS app DO reach the backend from the origin `capacitor://localhost`. However, iOS WKWebView blocks the `floot_built_app_session` session cookie because it is considered cross-site relative to the native app origin. The incoming requests show `hasCookieHeader: false` and `outcome: 'no-cookie'`. CORS is NOT the issue, as the requests are reaching the backend.

**Implemented Fix: Bearer-Token Fallback**
Because a server-side-only fix is impossible, the authentication mechanism has been augmented for native apps:
- **Backend:** `helpers/getSetServerSession` now supports an `Authorization: Bearer <jwt>` fallback in `getServerSessionOrThrow` when the session cookie is missing.
- **Token Delivery:** The four login/register endpoints, as well as `auth/session_GET`, return an optional `sessionToken` in the response body. `session_GET` generates a fresh token on every check to keep the 1-day JWT refreshed.
- **Native Client Storage:** The schema fetch wrappers (using `helpers/nativeSessionToken`) persist this token in `localStorage` and clear it on logout. Storage only occurs if `isNativeApp()` is true.
- **Request Interception:** `helpers/apiFetchGuard` intercepts `/_api/` requests and attaches the token via the `Authorization` header. If the header causes a network/CORS error, it retries without the header, disables it for the session, and reports the error via a diagnostic beacon.

**Web Clients**
Web clients (PWA/desktop) remain completely unaffected and continue to rely entirely on the secure, HttpOnly session cookie.

**Verification Results**
- Requests with Bearer token only (no cookie): return 200 OK.
- Requests with missing/invalid token (and no cookie): return 401 Unauthorized.
- Requests with cookie only (web path): return 200 OK.

**Critical Operational Note**
Because the frontend is baked into the native binary (local bundle), this token logic **only takes effect after a NEW native build/publish**. After updating the app, existing native users must log in again once to securely store the new Bearer token.

**Reading Diagnostics in Production**
- Use the `prod-backend-logs` bridge and filter for `native-probe`.
- The `outcome` field will now report `ok-cookie`, `ok-bearer`, `no-cookie`, or `jwt-invalid`.
- A successful authenticated request from a native app should log `hasAuthHeader: true` and `outcome: 'ok-bearer'`.
- *Note: The diagnostic probe in `helpers/logNativeRequestProbe` is temporary and can be safely removed once native authentication is confirmed fully functional in production.*