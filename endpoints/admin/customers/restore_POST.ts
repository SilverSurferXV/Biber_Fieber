import { schema } from "./restore_POST.schema";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { Transaction, sql } from "kysely";
import { DB } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      console.error("Non-admin user attempted to restore customers");
      return new Response(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const jsonText = await request.text();
    
    // Parse JSON while securely intercepting known ISO 8601 strings to revive into real Date objects
    // This maintains database timestamp column compatibility for batch inserts
    const json = JSON.parse(jsonText, (key, value) => {
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/.test(value)
      ) {
        return new Date(value);
      }
      return value;
    });

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid backup format" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { version, data } = parsed.data;
    if (version !== 1) {
      return new Response(JSON.stringify({ error: "Unsupported backup version" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    let restoredUsers = 0;

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // 1. Restore Users — Handle one by one to ensure we process uniqueness by both 'id' and 'email' effectively
      if (data.users && Array.isArray(data.users)) {
        for (const u of data.users) {
          try {
            const existingById = await trx.selectFrom("users").select("id").where("id", "=", u.id).executeTakeFirst();
            const existingByEmail = await trx.selectFrom("users").select("id").where("email", "=", u.email).executeTakeFirst();
            
            if (!existingById && !existingByEmail) {
              await trx.insertInto("users").values(u).execute();
              restoredUsers++;
            }
          } catch (err) {
            console.error(`Failed to insert user ${u.id}:`, err);
          }
        }
      }

      const batchSize = 200;

      // Helper to batch process data with fallback handling for standard UPSERT DO NOTHING behaviors
      async function insertIgnoreConflict<T extends keyof DB>(
        table: T,
        records: any[],
        conflictColumn: any,
        fallbackConflictColumn?: any
      ) {
        if (!records || !Array.isArray(records) || records.length === 0) return;
        
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          try {
            await trx.insertInto(table)
              .values(batch)
              .onConflict((oc) => oc.column(conflictColumn).doNothing())
              .execute();
          } catch (err: any) {
            if (fallbackConflictColumn) {
              try {
                await trx.insertInto(table)
                  .values(batch)
                  .onConflict((oc) => oc.column(fallbackConflictColumn).doNothing())
                  .execute();
              } catch (fallbackErr) {
                console.error(`Failed to insert batch into ${table} (fallback):`, fallbackErr);
              }
            } else {
              console.error(`Failed to insert batch into ${table}:`, err);
            }
          }
        }
      }

      // 2. Restore interrelated records, protecting original references with ON CONFLICT (... ) DO NOTHING mapping.
      // Falls back to ID constraint if User ID fails unique constraints rules on specific DB states
      await insertIgnoreConflict("userPasswords", data.userPasswords, "userId", "id");

      await insertIgnoreConflict("orders", data.orders, "id");
      await insertIgnoreConflict("orderItems", data.orderItems, "id");
      await insertIgnoreConflict("pointTransactions", data.pointTransactions, "id");
      await insertIgnoreConflict("reviews", data.reviews, "id");
      await insertIgnoreConflict("productRatings", data.productRatings, "id");
      await insertIgnoreConflict("userNotifications", data.userNotifications, "id");
      await insertIgnoreConflict("walletTopups", data.walletTopups, "id");
      await insertIgnoreConflict("driverCreditNotes", data.driverCreditNotes, "id");
      await insertIgnoreConflict("driverDeliveryRatings", data.driverDeliveryRatings, "id");
      await insertIgnoreConflict("driverTips", data.driverTips, "id");
      await insertIgnoreConflict("zoneDriverAssignments", data.zoneDriverAssignments, "id");

      // 3. Re-calculate sequences directly matching to the highest restored historical IDs,
      // avoiding insertion collisions for future organic data creation
      const tablesToReset = [
        "users", "user_passwords", "orders", "order_items",
        "point_transactions", "reviews", "product_ratings",
        "user_notifications", "wallet_topups", "driver_credit_notes",
        "driver_delivery_ratings", "driver_tips", "zone_driver_assignments"
      ];

      for (const table of tablesToReset) {
        try {
          // pg_get_serial_sequence robustly fetches the actual sequence attached to the identity column, handling dynamic names perfectly
          const query = sql.raw(`
            SELECT CASE 
              WHEN pg_get_serial_sequence('${table}', 'id') IS NOT NULL 
              THEN setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)
              ELSE NULL 
            END;
          `);
          await query.execute(trx);
        } catch (err) {
          console.error(`Failed to reset sequence for ${table}:`, err);
        }
      }
    });

    return new Response(JSON.stringify({ success: true, restoredUsers }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Error restoring backup:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}