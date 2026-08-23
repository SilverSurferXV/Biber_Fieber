# Native App API Error Investigation & Mitigation

**Symptom**  
Apple review rejection for iOS app: "JSON Parse error: Unrecognized token '<'" shown on the login screen.

**Investigation**  
- No row found in `login_attempts` DB table for the review timeframe.
- No Lambda invocation in the published backend logs at that time.  
- The login request never reached the backend.  
- The published web app functions normally. The published backend otherwise only sees scheduled-job traffic.

**Mitigation & Tracking (`helpers/apiFetchGuard`)**  
- `window.fetch` is globally patched (installed at module scope in `components/_globalContextProviders`).
- Detects HTML or non-JSON responses to `/_api/` endpoints (the source of the JSON parse error).
- Dispatches diagnostics via `navigator.sendBeacon` to `endpoints/diagnostics/client-error_POST`.  
  *Crucial:* Payload is sent as `text/plain` to remain a CORS-simple request and reach the server cross-origin without preflight blocks.
- Initiates a one-time retry against the absolute published origin: `https://biberfieber.floot.app`.
- Surfaces a user-friendly German connection error instead of the raw JSON parse exception.

**Diagnostic Boot Ping**  
- A one-time native boot ping is sent from `components/_globalContextProviders` to log the app's boot environment.
- **Reading Logs:** Use the `prod-backend-logs` bridge and filter for `"client-diagnostic"` to read both the boot pings and fetch guard reports.

**Findings from Test (23.08.2026)**
- In the installed iOS build (CFBundleVersion 38) NOTHING loads: shop shows no products and login fails with the JSON parse error. So the native app has never been able to reach the backend — it is not a transient Apple-reviewer network issue.
- Published web app works normally (verified in prod logs).
- Verified from the sandbox: ANY cross-origin request to https://biberfieber.floot.app fails (even a plain GET of /login) → the published app sends no CORS headers at all. Consequence: if the native shell really serves the frontend from a local bundle (capacitor://localhost), an absolute-URL retry from app code CANNOT succeed without Capacitor's native HTTP layer — that part is platform-level (capacitor.config / edge CORS) and not fixable from project code.

**Next Steps**
- Publish + create a TestFlight build so the "native app boot" beacon and apiFetchGuard diagnostics land in the production backend logs (read via prod-backend-logs, filter "client-diagnostic").
- This will reveal the real origin/protocol of the native webview. 
- Floot support (live chat) may be needed for the native build's API base / CORS.

**Capacitor & Hostname Assumptions**  
- `helpers/resolveFileUrl` assumes the hostname is `localhost` inside the native shell. This is an unverified assumption that the boot ping will confirm or disprove.
- **CORS Limitation:** Cross-origin `/_api/` calls from another origin naturally fail due to missing CORS headers (verified). If the native shell genuinely runs on `capacitor://localhost`, the absolute-URL retry strategy will fail due to CORS unless Capacitor's native HTTP layer intercepts and processes it.