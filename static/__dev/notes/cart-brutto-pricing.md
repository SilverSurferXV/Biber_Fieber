# Cart & Checkout Pricing Display

IMPORTANT: The cart (shop sidebar) and checkout page MUST always display **Brutto (gross)** prices, never Netto. The user has explicitly requested this and asked that it not be changed again.

## Tiered Pricing Model
- `priceNet` = total netto price for 1 piece
- `priceNet2` = total netto price for 2 pieces (NOT per-unit!)
- `priceNet3` = total netto price for 3 pieces (NOT per-unit!)
- No maximum quantity per product (unlimited)

## Key Functions (useCart)
- `getEffectivePrice(item)` returns the TOTAL netto price for the item's current quantity tier
- `getEffectiveBruttoPrice(item)` returns the TOTAL brutto price for the item's current quantity tier
- `getTotal()` sums `getEffectiveBruttoPrice(item)` directly — do NOT multiply by quantity
- Tax per item = `getEffectiveBruttoPrice(item) - getEffectivePrice(item)` — no * quantity

## Rules
- All displayed prices in cart/checkout are brutto
- Tiered pricing (priceNet2, priceNet3) applies for exactly 2 or 3 items.
- For qty > 3: if priceNet3 is set, per-unit price = priceNet3 / 3, total = (priceNet3 / 3) * qty. If priceNet3 not set, fallback to base price * qty.
- Strikethrough shows base brutto * qty vs discounted tier brutto