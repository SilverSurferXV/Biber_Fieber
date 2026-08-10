import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const url = new URL(request.url);
    const userIdsParam = url.searchParams.get("userIds");
    const selectedIds = userIdsParam ? userIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : null;

    if (user.role !== "admin") {
      console.error("Non-admin user attempted to backup customers");
      return new Response(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      });
    }

     // 1. Query all non-admin users
     const users = await db
       .selectFrom("users")
      .selectAll()
      .where("role", "!=", "admin")
      .$if(selectedIds !== null && selectedIds.length > 0, (qb) => qb.where("id", "in", selectedIds!))
      .execute();
 
     if (users.length === 0) {
      const emptyBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          users: [],
          userPasswords: [],
          orders: [],
          orderItems: [],
          pointTransactions: [],
          driverDeliveryRatings: [],
          driverTips: [],
          reviews: [],
          productRatings: [],
          userNotifications: [],
          walletTopups: [],
          driverCreditNotes: [],
          zoneDriverAssignments: [],
        },
      };
      
      return new Response(JSON.stringify(emptyBackup), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="biber-fieber-backup-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    const nonAdminUserIds = users.map((u) => u.id);

    // Arrays to collect data
    const userPasswords: any[] = [];
    const pointTransactions: any[] = [];
    const reviews: any[] = [];
    const productRatings: any[] = [];
    const userNotifications: any[] = [];
    const walletTopups: any[] = [];
    const driverCreditNotes: any[] = [];
    const zoneDriverAssignments: any[] = [];
    const ordersRaw: any[] = [];
    const driverDeliveryRatingsRaw: any[] = [];
    const driverTipsRaw: any[] = [];

    // Chunk the user IDs to avoid PostgreSQL's maximum parameter limits (usually 65,535)
    for (let i = 0; i < nonAdminUserIds.length; i += 5000) {
      const chunk = nonAdminUserIds.slice(i, i + 5000);
      
      userPasswords.push(...await db.selectFrom("userPasswords").selectAll().where("userId", "in", chunk).execute());
      pointTransactions.push(...await db.selectFrom("pointTransactions").selectAll().where("customerId", "in", chunk).execute());
      reviews.push(...await db.selectFrom("reviews").selectAll().where("customerId", "in", chunk).execute());
      productRatings.push(...await db.selectFrom("productRatings").selectAll().where("customerId", "in", chunk).execute());
      userNotifications.push(...await db.selectFrom("userNotifications").selectAll().where("userId", "in", chunk).execute());
      walletTopups.push(...await db.selectFrom("walletTopups").selectAll().where("customerId", "in", chunk).execute());
      driverCreditNotes.push(...await db.selectFrom("driverCreditNotes").selectAll().where("driverId", "in", chunk).execute());
      zoneDriverAssignments.push(...await db.selectFrom("zoneDriverAssignments").selectAll().where("driverId", "in", chunk).execute());
      
      ordersRaw.push(...await db.selectFrom("orders").selectAll()
        .where((eb) => eb.or([
          eb("customerId", "in", chunk),
          eb("deliveryDriverId", "in", chunk),
          eb("packerDriverId", "in", chunk)
        ])).execute());

      driverDeliveryRatingsRaw.push(...await db.selectFrom("driverDeliveryRatings").selectAll()
        .where((eb) => eb.or([
          eb("customerId", "in", chunk),
          eb("driverId", "in", chunk)
        ])).execute());

      driverTipsRaw.push(...await db.selectFrom("driverTips").selectAll()
        .where((eb) => eb.or([
          eb("customerId", "in", chunk),
          eb("driverId", "in", chunk)
        ])).execute());
    }

    // Deduplicate records where multiple relationships might have fetched the same record (e.g. user is both driver and customer)
     const orders = Array.from(new Map(ordersRaw.map(o => [o.id, o])).values());
     const driverDeliveryRatings = Array.from(new Map(driverDeliveryRatingsRaw.map(o => [o.id, o])).values());
     const driverTips = Array.from(new Map(driverTipsRaw.map(o => [o.id, o])).values());
 
     // Query orderItems chunked by orderIds
     const orderIds = orders.map((o) => o.id);
    const orderItems: any[] = [];
    if (orderIds.length > 0) {
      for (let i = 0; i < orderIds.length; i += 5000) {
        const chunk = orderIds.slice(i, i + 5000);
        orderItems.push(...await db.selectFrom("orderItems").selectAll().where("orderId", "in", chunk).execute());
      }
    }

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        users,
        userPasswords,
        orders,
        orderItems,
        pointTransactions,
        driverDeliveryRatings,
        driverTips,
        reviews,
        productRatings,
        userNotifications,
        walletTopups,
        driverCreditNotes,
        zoneDriverAssignments,
      },
    };

    return new Response(JSON.stringify(backupData), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="biber-fieber-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error generating backup:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}