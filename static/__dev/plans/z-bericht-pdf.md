---
created: 2026-05-12T20:25:38.312Z
updated: 2026-05-12T20:25:38.312Z
---

# Z-Bericht PDF Generator

## Summary
Add a "Z-Bericht" button to each daily section in the AdminDailyClosing component. Clicking the button generates a professional A4 PDF Z-Bericht (daily closing report) using pdfmake, containing all financial data for that day.

## Files to Create

### `helpers/generateZBerichtPdf`
A new helper that builds and opens a Z-Bericht PDF using pdfmake (same pattern as the existing `generateInvoicePdf` helper). The PDF should be A4 format and include:

**Header:**
- "Biber Fieber — Bio-Frühstück Lieferservice" as company name
- "Z-Bericht / Tagesabschluss" as document title
- Date formatted in German (e.g. "Montag, 15. Juni 2026")
- Z-Bericht number based on date (e.g. "Z-2026-06-15")

**Revenue Section:**
- Umsatz Brutto (gross revenue)
- Umsatz Netto (net revenue)

**Tax Breakdown Table:**
- Table with columns: Steuersatz, Netto, Steuerbetrag, Brutto
- One row per tax rate (e.g. 19%, 7%)
- Total row at the bottom

**Cost & Margin Section:**
- Wareneinsatz (cost of goods) in EUR
- DB1 (gross margin) in EUR
- DB1 as percentage of Netto

**Order Statistics:**
- Anzahl Bestellungen (number of orders)
- Anzahl Kunden (unique customers)
- Ø Bestellwert Brutto (average order value)

**Payment Method Breakdown (if data available):**
- Breakdown by payment method (points, stripe, etc.)

**Footer:**
- Timestamp of report generation (date + time)
- "Erstellt von: Biber Fieber Lieferplattform"

The helper receives the DailySummary data (or equivalent typed data) and uses pdfmake to generate and open the PDF. Follow the same initialization pattern as `generateInvoicePdf` (pdfmake + vfs_fonts, addVirtualFileSystem). Use Roboto font (default). All currency values formatted with German locale (Intl.NumberFormat).

## Files to Modify

### `components/AdminDailyClosing`
- Import the new `generateZBerichtPdf` helper
- Add a "Z-Bericht" button (styled with the existing Button component) inside each daily section box, positioned in the day header row next to the date title
- The button should have a PDF/download icon (from lucide-react, e.g. `FileText` or `Download`)
- On click, call the helper with that day's data
- Also pass along the payment method breakdown per day (extract from order data in the useMemo — group `order.paymentMethod` values and sum totals per method)

## Approach

1. Create `helpers/generateZBerichtPdf` — define the pdfmake document structure for the Z-Bericht with all sections described above
2. Update `components/AdminDailyClosing` — extend the DailySummary type to include payment method breakdown, update the useMemo to compute it, add the Z-Bericht button to each day section header, wire up the click handler

## Risks & Considerations
- The DailySummary data is computed in AdminDailyClosing's useMemo — we need to pass sufficient data to the PDF helper. May need to expand the DailySummary type to include payment method breakdown.
- pdfmake initialization is already set up in the project (same pattern as generateInvoicePdf), so no new dependencies needed.
- The `paymentMethod` field on orders may be null for some legacy orders — handle gracefully with "Unbekannt" fallback.
