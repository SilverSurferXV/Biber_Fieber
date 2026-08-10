import { schema, OutputType } from "./statistics_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // --- Real-time queries (analytics_events, last 7 days) ---
    const [
      recentTotalVisitorsRes,
      visitorsTodayRes,
      visitorsThisWeekRes,
      recentMonthVisitorsRes,
      recentAvgShopDurRes,
      recentTabClicksRes,
      recentPageVisitsRes,
      recentPlatformDurRes,
      recentShopPageVisitsRes,
      // Delivery zone ranking and weekly orders per customer (unchanged)
      deliveryZoneRankingRes,
      weeklyOrdersPerCustomerRes,
    ] = await Promise.all([
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.count("sessionId").distinct().as("cnt"))
        .where("createdAt", ">=", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.count("sessionId").distinct().as("cnt"))
        .where("createdAt", ">=", today)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.count("sessionId").distinct().as("cnt"))
        .where("createdAt", ">=", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.count("sessionId").distinct().as("cnt"))
        .where("createdAt", ">=", monthAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.avg("durationSeconds").as("avg"))
        .where("pagePath", "=", "/shop")
        .where("eventType", "=", "page_visit")
        .executeTakeFirst(),
      db
        .selectFrom("analyticsEvents")
        .select(["tabName", db.fn.count("id").as("cnt")])
        .where("eventType", "=", "tab_click")
        .where("tabName", "is not", null)
        .where("createdAt", ">=", weekAgo)
        .groupBy("tabName")
        .orderBy("cnt", "desc")
        .execute(),
      db
        .selectFrom("analyticsEvents")
        .select([
          "pagePath",
          db.fn.count("id").as("cnt"),
          db.fn.avg("durationSeconds").as("avgDur"),
        ])
        .where("eventType", "=", "page_visit")
        .where("createdAt", ">=", weekAgo)
        .groupBy("pagePath")
        .orderBy("cnt", "desc")
        .execute(),
      sql<{ avg: number }>`
        SELECT avg(total_duration) as avg FROM (
          SELECT sum(duration_seconds) as total_duration 
          FROM analytics_events 
          WHERE created_at >= ${sql.val(weekAgo)}
          GROUP BY session_id
        ) t
      `.execute(db),
      db
        .selectFrom("analyticsEvents")
        .select(db.fn.count("id").as("cnt"))
        .where("pagePath", "=", "/shop")
        .where("eventType", "=", "page_visit")
        .where("createdAt", ">=", weekAgo)
        .executeTakeFirst(),
      // Unchanged: delivery zone ranking
      db
        .selectFrom("orders")
        .innerJoin("deliveryZones", "orders.deliveryZoneId", "deliveryZones.id")
        .select([
          "deliveryZones.postcodePattern as postcode",
          "deliveryZones.cityName as cityName",
          db.fn.sum("orders.total").as("totalRevenue"),
          db.fn.count("orders.id").as("orderCount"),
          db.fn.avg("orders.total").as("avgRevenue"),
        ])
        .where("orders.status", "!=", "cancelled")
        .groupBy("deliveryZones.id")
        .groupBy("deliveryZones.postcodePattern")
        .groupBy("deliveryZones.cityName")
        .orderBy("avgRevenue", "desc")
        .execute(),
      // Unchanged: weekly orders per customer
      db
        .selectFrom("orders")
        .innerJoin("users", "orders.customerId", "users.id")
        .leftJoin("deliveryZones", (join) =>
          join.onRef("users.postcode", "=", "deliveryZones.postcodePattern")
        )
        .select([
          "users.id as userId",
          "users.firstName as firstName",
          "users.lastName as lastName",
          "users.email as email",
          "users.postcode as postcode",
          "deliveryZones.cityName as cityName",
          db.fn.count("orders.id").as("totalOrders"),
          db.fn.min("orders.orderDate").as("firstOrderDate"),
          db.fn.max("orders.orderDate").as("lastOrderDate"),
        ])
        .where("orders.status", "!=", "cancelled")
        .groupBy("users.id")
        .groupBy("users.firstName")
        .groupBy("users.lastName")
        .groupBy("users.email")
        .groupBy("users.postcode")
        .groupBy("deliveryZones.cityName")
        .execute(),
    ]);

    // --- Historical queries (analytics_daily, older than 7 days) ---
    const [
      histTotalVisitorsRes,
      histMonthVisitorsRes,
      histShopDurRes,
      histTotalUniqueSessionsRes,
      histTotalDurRes,
      histShopPageVisitsRes,
      histPageVisitsRes,
      histTopTabsRows,
    ] = await Promise.all([
      db
        .selectFrom("analyticsDaily")
        .select(db.fn.sum("uniqueSessions").as("cnt"))
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select(db.fn.sum("uniqueSessions").as("cnt"))
        .where("date", ">=", monthAgo)
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select([
          db.fn.sum("totalDurationSeconds").as("totalDur"),
          db.fn.sum("pageVisits").as("totalVisits"),
        ])
        .where("pagePath", "=", "/shop")
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select(db.fn.sum("uniqueSessions").as("totalSessions"))
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select(db.fn.sum("totalDurationSeconds").as("totalDur"))
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select(db.fn.sum("pageVisits").as("cnt"))
        .where("pagePath", "=", "/shop")
        .where("date", "<", weekAgo)
        .executeTakeFirst(),
      db
        .selectFrom("analyticsDaily")
        .select([
          "pagePath",
          db.fn.sum("pageVisits").as("cnt"),
          db.fn.sum("totalDurationSeconds").as("totalDur"),
        ])
        .where("date", "<", weekAgo)
        .groupBy("pagePath")
        .execute(),
      db
        .selectFrom("analyticsDaily")
        .select("topTabs")
        .where("date", "<", weekAgo)
        .where("topTabs", "is not", null)
        .execute(),
    ]);

    // --- Combine totalVisitors ---
    const recentTotalVisitors = Number(recentTotalVisitorsRes?.cnt ?? 0);
    const histTotalVisitors = Number(histTotalVisitorsRes?.cnt ?? 0);
    const totalVisitors = recentTotalVisitors + histTotalVisitors;

    // --- visitorsToday and visitorsThisWeek stay as-is ---
    const visitorsToday = Number(visitorsTodayRes?.cnt ?? 0);
    const visitorsThisWeek = Number(visitorsThisWeekRes?.cnt ?? 0);

    // --- Combine visitorsThisMonth ---
    const recentMonthVisitors = Number(recentMonthVisitorsRes?.cnt ?? 0);
    const histMonthVisitors = Number(histMonthVisitorsRes?.cnt ?? 0);
    const visitorsThisMonth = recentMonthVisitors + histMonthVisitors;

    // --- Combine avgShopDuration (weighted average) ---
    const recentShopCount = Number(recentShopPageVisitsRes?.cnt ?? 0);
    const recentShopAvg = Number(recentAvgShopDurRes?.avg ?? 0);
    const recentShopTotalDur = recentShopCount * recentShopAvg;

    const histShopVisits = Number(histShopDurRes?.totalVisits ?? 0);
    const histShopTotalDur = Number(histShopDurRes?.totalDur ?? 0);
    const combinedShopVisits = recentShopCount + histShopVisits;
    const combinedShopTotalDur = recentShopTotalDur + histShopTotalDur;
    const avgShopDuration =
      combinedShopVisits > 0
        ? combinedShopTotalDur / combinedShopVisits
        : 0;

    // --- Combine avgPlatformDuration (weighted average) ---
    const recentPlatformAvg = Number(recentPlatformDurRes.rows[0]?.avg ?? 0);
    const recentPlatformSessions = recentTotalVisitors;
    const recentPlatformTotalDur = recentPlatformSessions * recentPlatformAvg;

    const histPlatformSessions = Number(histTotalUniqueSessionsRes?.totalSessions ?? 0);
    const histPlatformTotalDur = Number(histTotalDurRes?.totalDur ?? 0);
    const combinedPlatformSessions = recentPlatformSessions + histPlatformSessions;
    const combinedPlatformTotalDur = recentPlatformTotalDur + histPlatformTotalDur;
    const avgPlatformDuration =
      combinedPlatformSessions > 0
        ? combinedPlatformTotalDur / combinedPlatformSessions
        : 0;

    // --- Combine tabClicks (merge recent + historical from JSONB topTabs) ---
    const tabClicksMap = new Map<string, number>();

    for (const r of recentTabClicksRes) {
      if (r.tabName) {
        tabClicksMap.set(
          r.tabName,
          (tabClicksMap.get(r.tabName) ?? 0) + Number(r.cnt)
        );
      }
    }

    // Parse historical topTabs JSON arrays and aggregate
    for (const row of histTopTabsRows) {
      if (row.topTabs && Array.isArray(row.topTabs)) {
        for (const entry of row.topTabs) {
          if (
            entry &&
            typeof entry === "object" &&
            "tabName" in entry &&
            "count" in entry
          ) {
            const tabName = String(entry.tabName);
            const count = Number(entry.count) || 0;
            tabClicksMap.set(
              tabName,
              (tabClicksMap.get(tabName) ?? 0) + count
            );
          }
        }
      }
    }

    const tabClicks = Array.from(tabClicksMap.entries())
      .map(([tabName, clickCount]) => ({ tabName, clickCount }))
      .sort((a, b) => b.clickCount - a.clickCount);

    // --- Combine pageVisits (merge recent + historical, weighted avg durations) ---
    const pageVisitsMap = new Map<
      string,
      { visitCount: number; totalDuration: number }
    >();

    for (const r of recentPageVisitsRes) {
      const count = Number(r.cnt);
      const avgDur = Number(r.avgDur ?? 0);
      const existing = pageVisitsMap.get(r.pagePath);
      if (existing) {
        existing.visitCount += count;
        existing.totalDuration += count * avgDur;
      } else {
        pageVisitsMap.set(r.pagePath, {
          visitCount: count,
          totalDuration: count * avgDur,
        });
      }
    }

    for (const r of histPageVisitsRes) {
      const count = Number(r.cnt ?? 0);
      const totalDur = Number(r.totalDur ?? 0);
      const existing = pageVisitsMap.get(r.pagePath);
      if (existing) {
        existing.visitCount += count;
        existing.totalDuration += totalDur;
      } else {
        pageVisitsMap.set(r.pagePath, {
          visitCount: count,
          totalDuration: totalDur,
        });
      }
    }

    const pageVisits = Array.from(pageVisitsMap.entries())
      .map(([pagePath, data]) => ({
        pagePath,
        visitCount: data.visitCount,
        avgDuration:
          data.visitCount > 0 ? data.totalDuration / data.visitCount : 0,
      }))
      .sort((a, b) => b.visitCount - a.visitCount);

    return new Response(
      superjson.stringify({
        totalVisitors,
        visitorsToday,
        visitorsThisWeek,
        visitorsThisMonth,
        avgShopDuration,
        avgPlatformDuration,
        tabClicks,
        pageVisits,
        weeklyOrdersPerCustomer: weeklyOrdersPerCustomerRes.map((r) => {
          const totalOrders = Number(r.totalOrders);
          const firstDate = r.firstOrderDate
            ? new Date(r.firstOrderDate as Date)
            : new Date();
          const lastDate = r.lastOrderDate
            ? new Date(r.lastOrderDate as Date)
            : new Date();
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const weeksBetween = Math.max(
            1,
            (lastDate.getTime() - firstDate.getTime()) / msPerWeek
          );
          const avgOrdersPerWeek = totalOrders / weeksBetween;
          const firstName = r.firstName ?? "";
          const lastName = r.lastName ?? "";
          const customerName =
            [firstName, lastName].filter(Boolean).join(" ") || r.email;
          return {
            customerName,
            email: r.email,
            totalOrders,
            avgOrdersPerWeek,
            postcode: r.postcode ?? null,
            cityName: r.cityName ?? null,
          };
        }).sort((a, b) => b.avgOrdersPerWeek - a.avgOrdersPerWeek),
        deliveryZoneRanking: deliveryZoneRankingRes.map((r, index) => ({
          rank: index + 1,
          postcode: r.postcode,
          cityName: r.cityName ?? "",
          totalRevenue: Number(r.totalRevenue ?? 0),
          orderCount: Number(r.orderCount),
          avgRevenue: Number(r.avgRevenue ?? 0),
        })),
      } satisfies OutputType)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(superjson.stringify({ error: msg }), {
      status: msg === "Forbidden" ? 403 : 400,
    });
  }
}