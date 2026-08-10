# Biber Fieber — Bio-Frühstück Lieferservice

## Pages

### Landing (Home `/`)
The home landing page. Contains:
- Hero area with shop branding.
- **Order countdown**: A live countdown in minutes (and seconds) showing how much time is left to order before the 16:00 cutoff for next-day delivery. If past 16:00, shows "Bestellschluss erreicht – Vorbestellung möglich".
- **WhatsApp button**: A prominent button linking to a WhatsApp chat (URL based on admin settings).
- **Social media buttons**: Links to Facebook, TikTok, and Instagram (configured in admin settings, hidden if not set).
- **Points widget**: For logged-in customers, shows current points balance and a top-up ("Aufladen") button. Prompts login for guests.
- **Weather widget**: A widget showing current weather conditions via Lottie animation (e.g., sunny, cloudy, rainy, snowy, thunderstorm), current temperature in °C, and current date/weekday in the active app language. Fetches weather from the Open-Meteo API based on the shop's configured location.
- A "Zum Shop" CTA button that links to `/shop`.

### Shop (`/shop`)
The main storefront. Shows whether the shop is currently open (based on configurable opening hours). Displays all 11 product categories as tabs or scroll sections that remain sticky at the top while the customer scrolls through products. Each category card shows its photo as a visual identifier. Each product card shows photo, name, article number, price, star rating average, and an "Add to cart" button. Products that are disabled in the admin are hidden. Customers can tap a product for details (description, external link, tax rate, quantity discount info). Cart icon in the header shows item count and links to checkout.

### Checkout (`/checkout`)
Shows the cart with quantities and totals. Delivery address is pre-filled from the customer profile. Shows the detected delivery zone (postcode), delivery fee, and minimum order value for that zone. If current time is past 16:00, only pre-order with date picker is shown; otherwise standard next-day delivery. Customer selects payment method (points balance, G-Pay, Apple Pay, credit card, PayPal, Klarna). Displays final point balance after order. Confirms order on submission.

### Account (`/account`)
Registration and login. Registration requires: first/last name, email, address (street, city, postcode), mobile number with country code, and a password (min 8 chars, 1 uppercase, 1 number, 1 special character). On registration a Bibercode is auto-generated. After login, the account page shows: profile photo (uploadable), personal details, language preference, notification preferences (email / SMS / both), points balance, Bibercode (shareable link with a one-click copy button directly next to it), monthly invoice viewer, and order history (showing unique order numbers). Customer can delete their own account.

### Sonderbereich (`/sonderbereich`)
Login-protected special downloads area for customers. Shows a list of PDF files uploaded by the admin. Each entry has a title, optional description, and a download/preview button.

### Admin (`/admin`)
Password-protected admin area. Tabs:
- **Products**: List of all products across all 11 categories. Create/edit/delete products. Fields: category, name, article number, photo upload, description (with external URL field), price, tax rate, cost price (€ and % of net price), quantity discount rules, active/inactive toggle.
- **Categories**: Manage the 11 product groups (name, photo upload, order, active toggle).
- **Orders**: Daily order overview — all orders grouped by day, with a per-product quantity summary for logistics. Filter by date. Displays the unique order number (`#YYYY-MM-DD-N`) for each order.
- **Customers**: List of all registered customers. Admin can fully edit all customer data fields (name, email, address, mobile number, postcode, notification preference, language preference, points balance), view Bibercode earnings, and delete accounts.
- **Delivery Zones**: Create/manage postcodes. Each zone has: postcode(s), delivery fee, minimum order value, active toggle. Shows count of registered customers per zone.
- **Settings**: Opening hours (weekday schedule), delivery days, order cutoff time (default 16:00), delivery time window display (0–6 am). Shop location (city name or coordinates for weather). Default shop language. Order confirmation message templates for email and SMS (supports placeholders like customer name, order number, items list, total, delivery date). Social and contact links: WhatsApp phone number, Facebook URL, TikTok URL, Instagram URL.
- **Reviews**: View all product reviews (1–5 stars + comment). Not visible to customers.
- **Push Notifications**: Compose and send push messages to all customers via OneSignal.
- **Sonderbereich**: Upload PDF files (stored via Cloudinary), set title and optional description, toggle active/inactive status, and delete files.

### Saved for later
- Customer-facing review submission (can be added to product detail later)
- Live order tracking

## User accounts
People create an account with email and password. The app remembers each customer's name, address, mobile number, profile photo, points balance, Bibercode, referred customers, order history, language preference, and delivery zone (auto-detected by postcode).

## What gets saved

- **Customers**: first name, last name, email, email verified flag, hashed password, street address, city, postcode, mobile number (with country code), profile photo (stored as URL via Cloudinary), language preference (German, English, Spanish, Italian, Turkish), notification preference (email / SMS / both), points balance (float), Bibercode (unique string), referred-by Bibercode, registration date, active/deleted flag.
- **Products**: article number, name, category, description text, external description URL, photo URL, price (net), tax rate (%), cost price (€), cost price (% of net), quantity discount tiers (JSON: min quantity → discount %), active flag, sort order.
- **Product categories**: name, photo URL, sort order, active flag.
- **Orders**: order number (format `#YYYY-MM-DD-N`), customer, delivery date, order date/time, delivery zone, payment method, items (product, quantity, unit price at time of order, tax rate), subtotal, delivery fee, total, points used, points earned, Bibercode points credited (5 % to referrer), order status.
- **Reviews**: product, customer, star rating (1–5), comment text, submitted at. Only visible in admin.
- **Delivery zones**: postcode pattern, delivery fee, minimum order value, active flag.
- **Wallet top-ups**: customer, amount topped up (€), bonus %, points credited, top-up date, payment method.
- **Point transactions**: customer, type (top-up / order payment / Bibercode credit / admin adjustment), amount, reference (order or top-up ID), date.
- **App settings**: opening hours per weekday (open/close time), delivery days (array of weekday flags), order cutoff time, delivery time window label, shop location (city name or coordinates for weather), default shop language, WhatsApp phone number, Facebook URL, TikTok URL, Instagram URL.
- **Notification templates**: template type (email/SMS), subject (email only), body text with placeholder support, last edited date.
- **Push notification log**: title, message body, sent at, sent by admin.
- **Sonderbereich files**: title, description text, PDF file URL, active flag, upload date.

## How it works

- **Points system**: 1 € = 1 point. Top-up bonuses: 15 € → no bonus, 25 € → +5 %, 50 € → +7 %, 100 € → +9 %, 200 € → +10 %, 500 € → +12 %. Points are credited immediately on top-up.
- **Bibercode system**: Each new customer gets a unique Bibercode at registration. If they register using someone else's Bibercode, that referrer permanently earns 5 % of every future order value (in points) placed by the referred customer. This runs automatically on every order.
- **Order number format**: Every order gets a unique order number in the format `#YYYY-MM-DD-N` where N is a daily sequential counter starting at 1 (e.g. #2024-06-15-1, #2024-06-15-2).
- **Email verification on registration**: After a customer registers, a confirmation email is sent to their email address. The account is inactive until the customer clicks the verification link. Unverified customers cannot log in or place orders.
- **Multi-language support**: The entire app (storefront, account pages, Sonderbereich, checkout) and the admin panel support 5 languages: German, English, Spanish, Italian, Turkish. All static UI strings are translated. The customer can set their preferred language in their account settings, defaulting to the admin-set default shop language.
- **Order cutoff**: Orders placed before 16:00 are delivered the next available delivery day. After 16:00 the checkout switches to pre-order mode and the customer must pick a future delivery date from allowed delivery days.
- **Delivery zones**: The customer's registered postcode is matched to a delivery zone. If no matching active zone exists, checkout is blocked with a message.
- **Monthly invoice**: Customers can view and download a monthly invoice listing every order grouped by calendar day, each order's value, and a month total. The invoice also shows total Bibercode points earned that month. Order numbers are displayed on the invoice.
- **Admin point adjustment**: Admins can add or subtract points from any customer with a required reason note; this creates a point transaction record.
- **Product visibility**: Disabled products are completely hidden on the storefront. Active flag is toggled per product in the admin.
- **Opening hours**: If the shop is outside its configured opening hours, the storefront shows a closed message and the cart/checkout are disabled.
- **Reviews**: Customers can submit a star rating and optional comment on any product they have ordered. Reviews are never shown publicly — only accessible in the admin reviews tab.
- **Order confirmation**: After a successful order, the system sends the confirmation to the customer via their chosen channel(s) based on their notification preferences (email, SMS, or both) using the customizable order confirmation templates.

## Look & feel

Warm, earthy, and slightly playful — organic food brand for conscious consumers who enjoy quality mornings. Brand palette drawn directly from the logo: dark charcoal (#2e2e2e) as the primary background, mint/teal (#6ECFB5) as the accent, and a warm red-to-orange gradient (#E8403A → #F5A623) for highlights and CTAs. The overall mood should feel premium yet approachable — not sterile, not flashy. Dark-mode-first with the charcoal base.

## Outside services

- **Cloudinary** — storing and serving product photos and customer profile photos.
- **OneSignal** — push notifications sent from the admin panel to all customers.
- **Stripe (or similar)** — processing real payments for wallet top-ups (G-Pay, Apple Pay, credit card, PayPal, Klarna). *(Can be wired up after core flow is built.)*
- **@react-pdf-viewer/core** — used for previewing PDF files in the Sonderbereich.
- **Resend** — transactional emails (verification, order confirmation).
- **Open-Meteo** — free weather API (no key required), used for the landing page weather widget.
- **lottie-web** — used for weather animations. *Implementation note: Must use `lottie-web` light build only to stay CSP-compliant in the deployed environment.*