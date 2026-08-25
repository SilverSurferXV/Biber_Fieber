# Stripe Wallet Top-up Flow Notes (Agent-Facing)

## ROOT CAUSE FOUND (supersedes the device-specific conclusions below)

- The real root cause of "Apple Pay / Google Pay never appears in the native app" was that the npm package `@capacitor-community/stripe` was NEVER INSTALLED, even though helpers/nativeStripeWallet.tsx was fully written to use it via a dynamic `window.Capacitor.Plugins.Stripe` lookup. With the package absent it was not bundled into the native build, so `getPlugin()` always returned null, `pluginAvailable` was always false, and TopupPaymentDialog ALWAYS fell through to the fragile browser handoff. All earlier debugging of the handoff/Stripe.js wallet probe was therefore investigating the fallback path, not the intended path.
- Fixed by installing `@capacitor-community/stripe` (v8.2.1). This requires a NEW NATIVE BUILD to take effect — publishing only the web version changes nothing for the native wallet path.
- The browser handoff opens via `window.open(res.url, "_blank")` in TopupPaymentDialog. In a Capacitor WebView this hands the URL to whatever the WebView decides — an in-app Custom Tab or the device default browser. One measured Android report came from Opera (`OPR/100`), which does not support Google Pay via Stripe. Treat the handoff as a last-resort fallback only, never as the primary wallet path.
- Authoritative API facts verified directly from the installed package's type definitions (NOT from web search, which was wrong about this): `PaymentSummaryItem.amount` is a decimal in the currency's MAJOR unit (euros, e.g. 10.99) and must NOT be converted to cents. `CreateGooglePayOption` has NO `isTesting` field, and its `paymentSummaryItems`, `merchantIdentifier`, `countryCode` and `currency` fields are documented "Web only" — natively only `paymentIntentClientSecret` is used. `CreateApplePayOption` genuinely requires paymentSummaryItems, merchantIdentifier, countryCode and currency. Result strings are "applePayCompleted"/"applePayCanceled"/"applePayFailed" and "googlePayCompleted"/"googlePayCanceled"/"googlePayFailed".
- The Android manifest already contains the required `com.google.android.gms.wallet.api.enabled` meta-data — do not re-add it.
- Open risks to check on the first native build: the plugin declares a peer dependency of `@capacitor/core >= 8.0.0`, so the build fails if Floot's Capacitor is older; and iOS Apple Pay additionally needs the Apple Pay entitlement for merchant ID `merchant.com.silversurfer.biberfieber` in the signing profile, which is controlled by the Floot build, not by app code. The user confirmed that exact merchant ID exists in the Apple Developer portal.
- helpers/nativeStripeWallet now beacons a "native wallet availability" diagnostic to /_api/diagnostics/client-error containing platform, pluginAvailable, applePay, googlePay and any rejection reasons. After a native build, read the backend logs for that message to confirm whether the plugin is present on the device.

- **Architecture:** Wallet top-up logic lives in `components/TopupPaymentDialog` (step 'select') and `components/WalletExpressCheckout` (which uses `ExpressCheckoutElement`). The manual card form stays in `CheckoutForm` with `PaymentElement`.
- **Hard rule for Elements:** `ExpressCheckoutElement` and `PaymentElement` must **NOT** share a single `<Elements>` group. Each step must mount its own `<Elements>` provider with the same `clientSecret`.
- **Eager Intent Creation:** One card/wallet PaymentIntent is created eagerly when the dialog opens (with `paymentMethod` set to `credit_card`). The `credit_card` selection tile reuses this intent. Alternate methods like `klarna` or `klarna_sofort` create their own intents upon selection, while `paypal` uses distinct PayPal buttons.
- **Confirm Payment:** Since the `<Elements>` group already contains the `clientSecret`, do **NOT** pass `clientSecret` directly to `stripe.confirmPayment` (Stripe.js will reject it).
- **Wallet Method Mapping (DB Enum):** When processing events, map `expressPaymentType` to the DB enum `payment_method_type` as follows: `apple_pay` -> `'apple_pay'`, `google_pay` -> `'gpay'`, and anything else falls back to `'credit_card'`.
- **Wallet Availability (`onReady`):** The `onReady` event of `ExpressCheckoutElement` yields `availablePaymentMethods`. This object must be checked for truthy values (e.g., `Object.values(methods).some(Boolean)`). Do not rely on `Object.keys().length` as it is truthy even when all specific wallet flags are false. There is a 5-second timeout fallback in the dialog that flags wallets as unavailable if `onReady` never fires (common in Capacitor webview contexts without native plugins).
- **Testing Constraints:** Wallet buttons will **NEVER** appear in the Floot editor preview because Stripe requires the iframe origin to match the top-level origin. Testing for Apple Pay/Google Pay must happen on the published domain: `https://biberfieber.floot.app`.
- **Stripe Dashboard Setup:** Apple Pay and Google Pay must be enabled in the Stripe dashboard, and the domain must be registered under "Payment method domains". No `/.well-known` file hosting is required as Stripe handles Apple merchant validation automatically.
- **Native Capacitor App Limitations:** The local Capacitor bundle runs on `capacitor://localhost`, making Apple Pay JS unavailable. Refer to `static/__dev/docs/apple-google-pay-einrichtung.md` for alternative solutions (e.g., setting the remote server URL vs using `@capacitor-community/stripe`, which requires the `com.apple.developer.in-app-payments` entitlement that Floot currently does not expose).
- **Backward Compatibility:** The backend endpoints `wallet/create-payment-intent` and `wallet/confirm-topup` must remain strictly backward compatible because the app is already shipped as a published native mobile app.
- **Native Browser-Handoff Flow:** To support Apple/Google Pay in Capacitor native apps, we use a browser handoff flow:
  - Database table `topupHandoffTokens` tracks single-use tokens (30 min expiry, status `pending`/`completed`/`expired`).
  - Endpoint `wallet/handoff/create_POST` (authenticated) creates the token and returns `${origin}/aufladen/${token}`. The origin is derived from `request.url`, so the native app automatically gets the published domain (via `apiFetchGuard`'s `PUBLISHED_ORIGIN` rewrite).
  - Endpoints `info_GET`, `create-intent_POST`, and `confirm_POST` are unauthenticated but strongly bound to the token and verified against the PaymentIntent's `metadata.handoffToken`.
  - The shared crediting helper `helpers/creditWalletTopup` is used by both `wallet/confirm-topup_POST` and the handoff confirm to ensure consistency.
  - The public page `pages/aufladen.$token` provides an isolated checkout screen (no app shell, noindex) and returns the user to the app via the Capacitor URL scheme `app.floot.u5b3d39f96d074ac4a072a41647c58fec://`.
  - Rule: In the native app (`isNativeApp()`), `TopupPaymentDialog` must **NEVER** mount `ExpressCheckoutElement`. It shows the handoff button instead, opening the system browser and refreshing the balance on `visibilitychange` (no polling).
  - Verification results: `create`/`info`/`create-intent` work correctly; `confirm` properly rejects unpaid and foreign PaymentIntents; expired tokens are flipped to `'expired'` automatically on read.
- **Native Wallet Sheets via Plugin:** 
  - Floot does not support Capacitor `server.url` / hostname spoofing (confirmed by support). However, plugins ARE supported. Do not propose the remote-bundle route again.
  - The exported native project runs on Capacitor 8.0.0, so the exact plugin version to install is `@capacitor-community/stripe@8.1.1`.
  - Android requires `minSdkVersion = 26` and `compileSdkVersion = 36` in `variables.gradle`. iOS requires Deployment Target `15.0` in `Podfile`.
  - Google Pay in v8 requires no `capacitor.config` values; `isTesting` is configured programmatically via our helper reading the `pk_test` prefix.
  - `helpers/nativeStripeWallet` accesses `@capacitor-community/stripe` ONLY dynamically through `window.Capacitor.Plugins.Stripe` / `Capacitor.registerPlugin("Stripe")`. Never import the npm package directly and never add it to package.json (no `@capacitor/core` in this project).
  - Plugin event strings are hardcoded (`applePayCompleted`/`applePayCanceled`/`googlePayCompleted`/`googlePayCanceled`); availability probes reject on failure instead of returning boolean false.
  - Hardcoded Apple merchant identifier is `merchant.com.silversurfer.biberfieber`.
  - The native wallet path deliberately reuses `wallet/create-payment-intent` with `credit_card` and `wallet/confirm-topup` with `apple_pay`/`gpay` — no new endpoints are needed, fully backward compatible.
  - Three-tier fallback in TopupPaymentDialog: native plugin wallet → browser handoff → card/Klarna/Sofort/PayPal tiles. `ExpressCheckoutElement` still must never mount in native mode.
  - Google Pay manifest meta-data lives in `static/__dev/native/android-manifest.xml` (persists across builds). The iOS Apple Pay entitlement must be manually re-applied in Xcode after every project download.

## Recent Verifications and Changes

- **Stripe Dashboard Configuration:** CONFIRMED correct. Verified live via `admin/stripe/status_GET` (lists domain `biberfieber.floot.app`, `enabled=true`, `applePay=active`, `googlePay=active`, `link=active`, `paypal=active`). Missing domain registration is ruled out as a cause; do not send the user to the Stripe dashboard for this again. `components/AdminStripe` now shows this list/warning.
- **Handoff Bug Fix:** `components/HandoffTopupCheckout` previously flipped to the card form after a 5s timeout, hiding the wallet section entirely (making the Safari handoff look like a plain CC form). Fixed: wallet and card sections are now always both visible (separate `<Elements>` groups, same `clientSecret`). Timeout increased to 12s, which now only marks "no wallet detected" and shows an explicit note when wallets are unavailable.
- **WalletExpressCheckout Enhancements:** Now reports raw `availablePaymentMethods` through `onReady` and handles `onLoadError`.
- **New Diagnostic:** Handoff page sends a one-time beacon via `diagnostics/client-error` (message: "handoff wallet availability") containing `availablePaymentMethods`, outcome source (`onReady`/timeout), `window.ApplePaySession` presence, `canMakePayments()`/`supportsVersion(3)` results, origin, userAgent, and iframe flag. Filter logs for this to check definitively whether the device itself can do Apple Pay.
- **Device Caveat:** Apple Pay in Safari requires a supported device AND a card in Wallet (frequently simply unavailable on iPad). A hidden wallet button is not automatically a code bug.
- **Known Debt:** `helpers/translationsDe/Es/It/Tr` are flagged as too long and must be split before adding further keys.

### Ruled Out / Current Investigation State

**Verified and Ruled Out (All verified via the admin Stripe status endpoint and real device diagnostics from the live domain):**
- **Stripe Account Payment Method Configuration:** `apple_pay`, `google_pay`, `link` and `card` are all `preference: on` / `value: on` on the default configuration; `livemode` true.
- **Stripe payment method domain registration:** `biberfieber.floot.app` is enabled, and `apple_pay` / `google_pay` / `link` / `paypal` are all `active` with `statusDetails: null`.
- **Permissions-Policy Header:** No `Permissions-Policy` header is sent by the platform at all, so the payment feature is not blocked for Stripe's iframes.
- **Apple Merchant Domain Association:** The `/.well-known/apple-developer-merchantid-domain-association` path returns the SPA shell (no static file in the project), yet Stripe still reports the domain verified — so this is NOT the blocker and no file needs to be added.
- **Key mode mismatch:** ruled out — frontend publishable key and backend secret key are BOTH live mode.
- **Missing `automatic_payment_methods` on the PaymentIntent:** not required; `payment_method_types: ["card"]` implicitly enables Apple Pay and Google Pay for the Express Checkout Element.
- **Editor iframe:** ruled out — device reports came from real browsers on the live domain with `isIframe: false`.
- **Express Checkout Element:** Loads fine. On Android, the legacy `paymentRequest.canMakePayment()` probe returned `{ applePay: false, googlePay: false, link: true }`. Link being true proves Stripe.js, the key, and the PaymentIntent are all fine, and that the intent-independent probe rules out the intent config.
- **Klarna Key:** The `klarna` key IS valid for the ExpressCheckoutElement `paymentMethods` option — removing it was not the fix.

**Final Conclusion (SUPERSEDED BY NATIVE PLUGIN DISCOVERY ABOVE):**
- On the iPad, `ApplePaySession.canMakePayments()` is true while Stripe's probe returns null. These two checks differ: `canMakePayments()` only reports device capability, whereas Stripe uses `canMakePaymentsWithActiveCard()`, which requires an actually provisioned card. Wallet cards are per-device, so an iPhone card does not make an iPad eligible.
- One Android report came from Opera (`OPR/100`), which does not support Google Pay via Stripe. Testing must be done in Chrome.
- **Therefore: no code-side defect remains in this flow.** The user tested Stripe's OWN Apple Pay reference demo (stripe.dev/apple-pay) in the same Safari on the same iPad and it also showed no Apple Pay button, while a card IS present in that iPad's Wallet. Since Stripe's own reference page fails on that device, the integration in this project is conclusively not at fault — do not re-investigate the Stripe setup, the domain, the keys, the PaymentIntent or the Express Checkout Element for this symptom again.
- When wallets do not appear, the expected device-side causes to check first next time are:
  - The iOS/iPadOS Safari toggle "Check for Apple Pay and Apple Card" (Settings → Apps → Safari → Privacy & Security) being off. This lets `ApplePaySession` exist and `canMakePayments()` return true while the active-card check still fails.
  - Private browsing mode being active.
  - A Wallet card that is added but not fully verified/active.
  - A missing provisioned card in that specific device's wallet.
  - An unsupported browser (e.g., Opera on Android).
- **Key debugging lesson:** `canMakePayments()` being true does NOT mean Apple Pay is usable. Always compare against Stripe's probe before suspecting the integration.
- The handoff page now shows a signal-specific hint (e.g., device supports Apple Pay but has no card, browser does not support wallets, or a generic unavailable message) instead of one generic sentence.

- **Trap that cost a round:** `endpoints/diagnostics/client-error_POST` used a strict zod schema, so all nested diagnostic detail was silently stripped before logging. It is now passthrough with an optional `context` record, and the context is JSON-serialized into the log line. When adding new diagnostics, always send detail inside `context`.