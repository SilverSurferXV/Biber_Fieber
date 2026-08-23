# Optional Registration Fields & Wallet Top-up Enforcement

This document outlines the rules and technical implementation for handling optional customer profile fields during registration and enforcing them later when the user attempts to top up their wallet.

## 1. Registration (Optional Fields)
During initial user registration, the following fields are strictly **OPTIONAL**:
- PLZ (Postcode)
- Stadt (City)
- Straße & Hausnummer (Street Address)
- Handynummer (Mobile Number)
- Geburtsdatum (Date of Birth)

**Implementation details:**
- In the `register_with_password` endpoint schema, these fields must be marked as `.optional()` and stored as `null` in the database if not provided.
- In the frontend registration form UI, their labels should be marked as optional using the translation key `t("register.optional")`.

## 2. Wallet Top-up (Mandatory Fields)
Before a user can execute a wallet top-up, all of the aforementioned fields become **MANDATORY**. 

**Frontend Implementation:**
- **Single Source of Truth:** `helpers/profileCompleteness` is the definitive utility for checking missing fields. It evaluates whether the profile has all required fields and returns a list of missing fields.
- **UI Flow:** 
  - The check is triggered inside `components/AccountPoints` before opening the `TopupPaymentDialog`.
  - If fields are missing, `components/CompleteProfileDialog` is presented to collect the missing data.
- **Delivery Zone Check:** `CompleteProfileDialog` uses the same robust PLZ delivery-zone check as the main registration form:
  - **Active Zone:** Updates the profile and proceeds.
  - **Inactive (but existing) Zone:** Displays a nested confirmation dialog warning the user before allowing them to save.
  - **No Matching Zone:** Blocks the update entirely.

## 3. Backend Enforcement
To ensure data integrity, the mandatory field rule is also enforced on the backend during the payment creation phase.

**Enforced Endpoints:**
- `endpoints/wallet/create-payment-intent_POST` (Stripe)
- `endpoints/wallet/paypal/create-order_POST` (PayPal)
- *Behavior:* If the user profile is incomplete (checked via `profileCompleteness`), these endpoints must return a `400` status with a descriptive German error message (e.g., "Bitte vervollständigen Sie Ihr Profil, bevor Sie Guthaben aufladen.").

**Profile Updates:**
- `endpoints/customer/profile/update_POST` supports updating all these fields, notably including `dateOfBirth`.

**Legacy Exceptions:**
- The legacy simulated top-up endpoint (`endpoints/wallet/topup_POST`) is **NOT** gated by this check and remains accessible for testing/legacy purposes.

## 4. Minimum Age Requirement (18+)
A strict minimum-age rule of 18 years is enforced across the platform for critical actions.

**Single Source of Truth:**
- `helpers/isAdult` is the definitive utility for all age checks. It accurately calculates exact calendar age and seamlessly handles `Date` objects, ISO strings, and German "TT.MM.JJJJ" formatted strings. It strictly returns `false` for invalid or future dates. **Never reimplement age math.**

**Backend Enforcement:**
- **Checkout (`endpoints/cart/checkout_POST`):** Requires a Date of Birth to be present on the user's profile AND the user must be at least 18 years old.
  - If missing: *"Bitte hinterlege dein Geburtsdatum in deinem Profil, um zu bestellen."*
  - If under 18: *"Du musst mindestens 18 Jahre alt sein, um bei uns zu bestellen."*
- **Profile & Registration:** `endpoints/customer/profile/update_POST` and `endpoints/auth/register_with_password_POST` explicitly reject under-18 DOBs (Note: for registration, the field remains optional, but if provided, it must be valid and 18+).
- **Wallet Top-ups:** Both live top-up endpoints (Stripe and PayPal) reject under-18 users in addition to the standard `profileCompleteness` checks.

**Frontend Enforcement:**
- **Checkout Page (`pages/checkout`):** Automatically blocks and disables the order button while displaying a toast error if the user is missing a DOB or is under 18.
- **Form Validations:** `components/AccountProfile`, `components/CompleteProfileDialog`, and `components/PasswordRegisterForm` validate the DOB input strictly via Zod refinements utilizing `isAdult`.
- **Translation Keys:** All age-related UI errors utilize the `age.min_18` and `age.dob_required` keys, which are maintained across all five translation helpers.