# Company-Car Deduction Rule (Agent Note)

**Rule:** A stop driven with the company car pays 0.35 € less than the driver's base `stopCompensation`. The constant for this deduction is stored in `helpers/companyCarDeduction`.

**Car Type Source:** 
- The car type is initially tracked in `zone_driver_assignments.car_type` ('company' | 'private'), grouped by `date_key` + `postcode` (managed in AdminOrders).
- At the time of delivery, `endpoints/driver/order/deliver_POST` stamps this value onto `orders.delivery_car_type`. This ensures that later edits to zone assignments cannot change historical pay.
- The zone assignment is only used as a fallback when the stamp is `NULL` (for older orders before the stamping system was introduced).

**Single Source of Calculation:** 
- `helpers/computeDriverStopEarnings` (backend only) is the single source of truth for these calculations.
- It is used by `endpoints/driver/earnings_GET`, `endpoints/admin/driver/earnings_GET`, and the auto-generate path of `endpoints/admin/credit-note/save_POST`.
- **CRITICAL:** Never recompute stops × stopCompensation anywhere else. Always sum the per-day net `earnings` from this helper.

**Shape & Totals:**
- **Per-day shape:** `{ date, stopsCount, companyCarStops, grossEarnings, carDeduction, earnings }` where `earnings` is the net payout.
- **Totals:** `totalStops`, `totalCompanyCarStops`, `totalGrossEarnings`, `totalCarDeduction`, `totalEarnings` (net).

**Credit Notes & PDFs:**
- `driver_credit_notes.total_car_deduction` stores the total deduction amount. 
- `total_stop_earnings` stays NET so the `total_amount` math remains unchanged. 
- `detailData` carries the per-day fields + `totalCarDeduction` (older notes lack them and fall back to 0).
- PDFs (`helpers/generateGutschriftPdf` + `generateGutschriftPdfBuffer`) must stay byte-for-byte equivalent. They display a "davon Firmenwagen" column and, when the deduction is > 0, show three summary lines: gross / deduction / net. 
- `components/DriverCreditNotes` mirrors the same logic in HTML.

**Verification:**
Verified in 2026 with seeded temp data: 
- Base pay 3 €/stop
- 2 company stops → 5.30 € total (6 € gross - 0.70 € deduction)
- Stamped company stop → 2.65 € 
- Private day remains unchanged (3.00 €/stop).