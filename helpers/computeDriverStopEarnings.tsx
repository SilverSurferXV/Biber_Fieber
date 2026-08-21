import { db } from "./db";
import { sql } from "kysely";
import { companyCarDeduction } from "./companyCarDeduction";

export type DriverStopEarningsDay = {
  date: string;            // YYYY-MM-DD, effective delivery day
  stopsCount: number;      // all delivered stops that day
  companyCarStops: number; // stops of that day driven with the company car
  grossEarnings: number;   // stopsCount * stopCompensation
  carDeduction: number;    // companyCarStops * companyCarDeduction
  earnings: number;        // grossEarnings - carDeduction (net payout)
};

type ComputeDriverStopEarningsParams = {
  driverId: number;
  stopCompensation: number;
  from?: Date | string | null;     // inclusive, optional
  to?: Date | string | null;       // inclusive, optional
  orderDirection?: "asc" | "desc"; // default "desc"
};

type ComputeDriverStopEarningsResult = {
  dailyEarnings: DriverStopEarningsDay[];
  totalStops: number;
  totalCompanyCarStops: number;
  totalGrossEarnings: number;
  totalCarDeduction: number;
  totalEarnings: number; // net
};

/**
 * Backend-only helper to compute a driver's daily and total stop earnings.
 * Includes deductions for stops driven using a company car.
 */
export const computeDriverStopEarnings = async (
  params: ComputeDriverStopEarningsParams
): Promise<ComputeDriverStopEarningsResult> => {
  const { driverId, stopCompensation, from, to, orderDirection = "desc" } = params;

  // Grouping expression: delivery_date fallback to created_at
  const dateExpr = sql`COALESCE(orders.delivery_date::date, orders.created_at::date)`;
  const dateTextExpr = sql<string>`COALESCE(orders.delivery_date::date, orders.created_at::date)::text`;

  // Customer postcode resolution for resolving the assignment
  const postcodeExpr = sql<string>`
    CASE 
      WHEN cu.delivery_address_same_as_billing = false AND cu.delivery_postcode IS NOT NULL 
      THEN cu.delivery_postcode 
      ELSE cu.postcode 
    END
  `;

  // Stamped delivery_car_type overrides historical zone driver assignment
  const carTypeExpr = sql<string>`COALESCE(orders.delivery_car_type, zda.car_type)`;

  let query = db
    .selectFrom("orders")
    .leftJoin("users as cu", "orders.customerId", "cu.id")
    .leftJoin("zoneDriverAssignments as zda", (join) =>
      join
        .on((eb) => eb("zda.dateKey", "=", dateTextExpr))
        .on((eb) => eb("zda.postcode", "=", postcodeExpr))
    )
    .where("orders.deliveryDriverId", "=", driverId)
    .where("orders.status", "=", "delivered")
    .select([
      dateTextExpr.as("date"),
      sql<number>`COUNT(DISTINCT orders.id)::int`.as("stopsCount"),
      sql<number>`COUNT(DISTINCT CASE WHEN ${carTypeExpr} = 'company' THEN orders.id END)::int`.as("companyCarStops"),
    ])
    .groupBy(dateExpr);

  if (from) {
    query = query.where(dateExpr, ">=", sql`${from}::date`);
  }

  if (to) {
    query = query.where(dateExpr, "<=", sql`${to}::date`);
  }

  query = query.orderBy(dateExpr, orderDirection);

  const rows = await query.execute();

  let totalStops = 0;
  let totalCompanyCarStops = 0;
  let totalGrossEarnings = 0;
  let totalCarDeduction = 0;
  let totalEarnings = 0;

  const dailyEarnings: DriverStopEarningsDay[] = rows.map((row) => {
    const stopsCount = row.stopsCount ?? 0;
    const companyCarStops = row.companyCarStops ?? 0;

    const grossEarnings = Number((stopsCount * stopCompensation).toFixed(2));
    const carDeduction = Number((companyCarStops * companyCarDeduction).toFixed(2));
    const earnings = Number((grossEarnings - carDeduction).toFixed(2));

    totalStops += stopsCount;
    totalCompanyCarStops += companyCarStops;
    totalGrossEarnings += grossEarnings;
    totalCarDeduction += carDeduction;
    totalEarnings += earnings;

    return {
      date: row.date,
      stopsCount,
      companyCarStops,
      grossEarnings,
      carDeduction,
      earnings,
    };
  });

  console.log(
    `[computeDriverStopEarnings] Driver ${driverId} | Range: ${from || "any"} - ${to || "any"} | Total stops: ${totalStops} (Company car: ${totalCompanyCarStops}) | Net Earnings: €${totalEarnings.toFixed(2)}`
  );

  return {
    dailyEarnings,
    totalStops,
    totalCompanyCarStops,
    totalGrossEarnings: Number(totalGrossEarnings.toFixed(2)),
    totalCarDeduction: Number(totalCarDeduction.toFixed(2)),
    totalEarnings: Number(totalEarnings.toFixed(2)),
  };
};