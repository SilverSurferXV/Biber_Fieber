import superjson from "superjson";
import { OutputType } from "./status_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { PAYPAL_MODE, PAYPAL_CLIENT_ID } from "../../../helpers/_publicConfigs";
import { db } from "../../../helpers/db";

if (!process.env.PAYPAL_SECRET_KEY) {
  throw new Error("PAYPAL_SECRET_KEY is not set");
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const secret = process.env.PAYPAL_SECRET_KEY;
    const isLive = PAYPAL_MODE.toLowerCase().includes("live");
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${secret}`).toString("base64");
    
    let connected = false;
    let errorMsg = undefined;

    try {
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${auth}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        throw new Error("Failed to get access token");
      }
      const data = await response.json();
      if (data.access_token) {
        connected = true;
      } else {
        errorMsg = "No access token received";
      }
    } catch (err: any) {
      errorMsg = err.message || "Unknown error connecting to PayPal";
    }

    const topupsRows = await db
      .selectFrom("walletTopups")
      .leftJoin("users", "walletTopups.customerId", "users.id")
      .where("walletTopups.paymentMethod", "=", "paypal")
      .orderBy("walletTopups.topupDate", "desc")
      .limit(20)
      .select([
        "walletTopups.id",
        "walletTopups.amount",
        "walletTopups.bonusPercent",
        "walletTopups.pointsCredited",
        "walletTopups.topupDate",
        "users.firstName",
        "users.lastName",
        "users.email",
      ])
      .execute();

    const recentTopups = topupsRows.map(row => ({
      id: row.id,
      amount: Number(row.amount),
      bonusPercent: row.bonusPercent != null ? Number(row.bonusPercent) : null,
      pointsCredited: Number(row.pointsCredited),
      topupDate: row.topupDate ? new Date(row.topupDate) : null,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
    }));

    const maskedClientId = PAYPAL_CLIENT_ID
      ? `${PAYPAL_CLIENT_ID.substring(0, 6)}••••••`
      : "";

    return new Response(
      superjson.stringify({
        connected,
        mode: PAYPAL_MODE,
        clientId: maskedClientId,
        error: errorMsg,
        recentTopups
      } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return new Response(
      superjson.stringify({ error: error.message }), { status: 400 }
    );
  }
}