import { sql } from "kysely";
import { db } from "./db";
import { Json } from "./schema";

/**
 * Scheduled job to compress old analytics events into daily aggregates
 * and then delete the raw events to save space.
 */
export const compressLogs = async (): Promise<void> => {
  console.log("[Scheduled Job] Starting compressLogs...");

  try {
    // 1. Calculate cutoff date (7 days ago, truncated to start of day)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    cutoffDate.setHours(0, 0, 0, 0);

    // 2. Aggregate metrics using a raw query
    // We cast to proper types because raw queries might return strings for numeric aggregates in Postgres
    const aggregated = await sql<{
      dateStr: string;
      pagePath: string;
      uniqueSessions: number;
      pageVisits: number;
      tabClicks: number;
      totalDurationSeconds: number;
      avgDurationSeconds: number;
    }>`
      SELECT 
        DATE(created_at)::text as "dateStr",
        page_path as "pagePath",
        COUNT(DISTINCT session_id)::integer as "uniqueSessions",
        COUNT(*) FILTER (WHERE event_type = 'page_visit')::integer as "pageVisits",
        COUNT(*) FILTER (WHERE event_type = 'tab_click')::integer as "tabClicks",
        COALESCE(SUM(duration_seconds), 0)::float as "totalDurationSeconds",
        COALESCE(AVG(duration_seconds), 0)::float as "avgDurationSeconds"
      FROM analytics_events
      WHERE created_at < ${cutoffDate}
      GROUP BY DATE(created_at), page_path
    `.execute(db);

    if (aggregated.rows.length === 0) {
      console.log("[Scheduled Job] No old analytics events to compress.");
      return;
    }

    // 2b. Use a separate query to get tab_name counts
    const tabCounts = await sql<{
      dateStr: string;
      pagePath: string;
      tabName: string;
      count: number;
    }>`
      SELECT 
        DATE(created_at)::text as "dateStr",
        page_path as "pagePath",
        tab_name as "tabName",
        COUNT(*)::integer as "count"
      FROM analytics_events
      WHERE created_at < ${cutoffDate} AND tab_name IS NOT NULL
      GROUP BY DATE(created_at), page_path, tab_name
    `.execute(db);

    // Group tabs by date + pagePath
    const tabsMap = new Map<string, Array<{ tabName: string; count: number }>>();
    for (const row of tabCounts.rows) {
      const key = `${row.dateStr}_${row.pagePath}`;
      if (!tabsMap.has(key)) {
        tabsMap.set(key, []);
      }
      tabsMap.get(key)!.push({ tabName: row.tabName, count: row.count });
    }

    // 3. Upsert into analytics_daily and 4. Delete raw records in a transaction
    // This ensures we do not delete raw data if the aggregation/upsert fails.
    await db.transaction().execute(async (trx) => {
      let upsertCount = 0;

      for (const row of aggregated.rows) {
        const key = `${row.dateStr}_${row.pagePath}`;
        // Sort tabs by count descending and take top 5
        const topTabsRaw = (tabsMap.get(key) || [])
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Convert the date string back into a Date object for Kysely insertion
        const rowDate = new Date(row.dateStr);

        // Find existing record for this date and path (simulating ON CONFLICT if no unique constraint exists)
        const existing = await trx
          .selectFrom("analyticsDaily")
          .selectAll()
          .where("date", "=", rowDate)
          .where("pagePath", "=", row.pagePath)
          .executeTakeFirst();

        if (existing) {
          await trx
            .updateTable("analyticsDaily")
            .set({
              uniqueSessions: row.uniqueSessions, // Use new value as requested
              pageVisits: Number(existing.pageVisits || 0) + row.pageVisits,
              tabClicks: Number(existing.tabClicks || 0) + row.tabClicks,
              totalDurationSeconds:
                Number(existing.totalDurationSeconds || 0) +
                row.totalDurationSeconds,
              avgDurationSeconds: row.avgDurationSeconds,
              topTabs: topTabsRaw as unknown as Json, 
            })
            .where("id", "=", existing.id)
            .execute();
        } else {
          await trx
            .insertInto("analyticsDaily")
            .values({
              date: rowDate,
              pagePath: row.pagePath,
              uniqueSessions: row.uniqueSessions,
              pageVisits: row.pageVisits,
              tabClicks: row.tabClicks,
              totalDurationSeconds: row.totalDurationSeconds,
              avgDurationSeconds: row.avgDurationSeconds,
              topTabs: topTabsRaw as unknown as Json,
            })
            .execute();
        }
        upsertCount++;
      }

      console.log(`[Scheduled Job] Aggregated and upserted ${upsertCount} daily records.`);

      // 4. Delete the raw events older than the cutoff AFTER successful upsert
      const deleteResult = await trx
        .deleteFrom("analyticsEvents")
        .where("createdAt", "<", cutoffDate)
        .execute();

      const numDeleted = deleteResult.reduce(
        (acc, r) => acc + Number(r.numDeletedRows || 0),
        0
      );

      console.log(`[Scheduled Job] Deleted ${numDeleted} raw analytics events.`);
    });

    console.log("[Scheduled Job] compressLogs completed successfully.");
  } catch (error) {
    console.error(
      "[Scheduled Job] Failed to execute compressLogs:",
      error instanceof Error ? error.message : "Unknown error",
      error
    );
  }
};