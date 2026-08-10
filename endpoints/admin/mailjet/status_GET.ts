import superjson from "superjson";
import { OutputType, SenderRecord, MessageRecord } from "./status_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

if (!process.env.MAILJET_API_KEY) {
  throw new Error("MAILJET_API_KEY is not set");
}

if (!process.env.MAILJET_SECRET_KEY) {
  throw new Error("MAILJET_SECRET_KEY is not set");
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const apiKey = process.env.MAILJET_API_KEY;
    const secret = process.env.MAILJET_SECRET_KEY;
    const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
    
    const headers = {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    };

    let connected = false;
    let errorMsg = undefined;
    let senders: SenderRecord[] = [];
    let recentMessages: MessageRecord[] = [];

    try {
      // 1. Check API Key
      const apiKeyRes = await fetch("https://api.mailjet.com/v3/REST/apikey", { headers });
      if (!apiKeyRes.ok) {
        throw new Error(`Failed to authenticate Mailjet API. Status: ${apiKeyRes.status}`);
      }
      const apiKeyData = await apiKeyRes.json();
      if (apiKeyData && apiKeyData.Data && apiKeyData.Data.length > 0) {
        connected = true;
      } else {
        errorMsg = "Valid connection, but no active API key data found.";
      }

      const senderMap = new Map<number, string>();
      // 2. Fetch Senders
      const sendersRes = await fetch("https://api.mailjet.com/v3/REST/sender", { headers });
      if (sendersRes.ok) {
        const sendersData = await sendersRes.json();
        if (sendersData.Data) {
         senders = sendersData.Data
            .filter((s: any) => !s.Email.startsWith("*@"))
            .map((s: any) => ({
              email: s.Email,
              status: s.Status,
              createdAt: s.CreatedAt ? new Date(s.CreatedAt) : null,
            }));
        }
        if (sendersData.Data) {
          for (const s of sendersData.Data) {
            if (s.ID != null && s.Email) {
              senderMap.set(s.ID, s.Email);
            }
          }
        }
      }

      // 3. Fetch Recent Messages
      const msgsRes = await fetch("https://api.mailjet.com/v3/REST/message?Limit=20&Sort=ArrivedAt+DESC&ShowSubject=true&ShowContactAlt=true", { headers });
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        if (msgsData.Data) {
          recentMessages = msgsData.Data.map((m: any) => ({
            id: m.ID,
            status: m.Status,
            subject: m.Subject || "-",
            sentAt: m.ArrivedAt ? new Date(m.ArrivedAt) : null,
           to: m.ContactAlt || m.ToEmail || m.To || "-",
          from: (() => { const rs = senderMap.get(m.SenderID); return (rs && !rs.startsWith("*@")) ? rs : (m.FromEmail || "-"); })(),
          }));
        }
      }

    } catch (err: any) {
      errorMsg = err.message || "Unknown error connecting to Mailjet";
    }

    const maskedApiKey = apiKey
      ? `${apiKey.substring(0, 6)}••••••••••••••••••••••••`
      : "";

    return new Response(
      superjson.stringify({
        connected,
        error: errorMsg,
        maskedApiKey,
        senders,
        recentMessages
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