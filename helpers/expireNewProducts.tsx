import { sql } from "kysely";
import { db } from "./db";

/**
 * Scheduled job to check all products marked as 'new'.
 * If the duration has passed since they were marked,
 * this resets their new status in a single SQL update.
 */
export const expireNewProducts = async (): Promise<void> => {
  try {
    console.log("Running expireNewProducts job...");

    const result = await db
      .updateTable("products")
      .set({
        isNew: false,
        newMarkedAt: null,
        newDurationDays: null,
      })
      .where("isNew", "=", true)
      .where("newMarkedAt", "is not", null)
      .where("newDurationDays", "is not", null)
      // We use raw sql for the date math because Kysely's standard operators
      // don't support dynamic interval math out of the box.
      // Column names in raw sql must be snake_case as it bypasses the camelCase plugin.
      .where(
        sql`new_marked_at + (new_duration_days * interval '1 day')`,
        "<=",
        sql`now()`
      )
      .executeTakeFirst();

    const count = result.numUpdatedRows?.toString() ?? "0";
    console.log(`Finished expireNewProducts job. Expired ${count} products.`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in expireNewProducts job:", error.message);
    } else {
      console.error("Unknown error in expireNewProducts job:", error);
    }
  }
};