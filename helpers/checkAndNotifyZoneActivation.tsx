import { db } from "./db";
import { ONESIGNAL_APP_ID } from "./_publicConfigs";

/**
 * Checks whether a given postcode matches a pattern.
 * E.g. "82256" matches "82256", "822*" matches "82256" via regex.
 */
function postcodeMatchesPattern(postcode: string, pattern: string): boolean {
  if (pattern === postcode) return true;
  const regexPattern = "^" + pattern.replace(/\*/g, ".*") + "$";
  try {
    return new RegExp(regexPattern).test(postcode);
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a newly registered user's postcode reached the delivery zone's activation threshold,
 * and if so, sends a OneSignal push notification to subscribed users.
 */
export async function checkAndNotifyZoneActivation(userPostcode: string): Promise<void> {
  try {
    // 1. Load all delivery zones
    const zones = await db.selectFrom("deliveryZones").selectAll().execute();

    // 2. Find the zone matching the user's postcode
    const matchedZone = zones.find((zone) => postcodeMatchesPattern(userPostcode, zone.postcodePattern));

    // 3. If no matching zone, or no activationThreshold, return early
    if (!matchedZone || !matchedZone.activationThreshold || matchedZone.activationThreshold <= 0) {
      return;
    }

    // 4. Count active users matching this zone's pattern
    const activeUsers = await db
      .selectFrom("users")
      .where("active", "=", true)
      .select(["id", "postcode"])
      .execute();

    const matchedUsers = activeUsers.filter(
      (u) => u.postcode != null && postcodeMatchesPattern(u.postcode, matchedZone.postcodePattern)
    );
    const matchedUserCount = matchedUsers.length;

    // 5. If userCount exactly equals activationThreshold, notify
    if (matchedUserCount === matchedZone.activationThreshold) {
      const matchedUserIds = matchedUsers.map((u) => String(u.id));
      if (matchedUserIds.length === 0) return;

      const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
      if (!oneSignalApiKey) {
        console.error("ONESIGNAL_REST_API_KEY environment variable is not set. Cannot send zone activation push notification.");
        return;
      }

      const title = "Liefergebiet freigeschalten! 🎉";
      const message = "Lieber Kunde, tolle Nachrichten! Dein Liefergebiet wurde freigeschalten, von nun an kannst du von uns beliefert werden. 😊";

      try {
        const notificationValues = matchedUsers.map((u) => ({
          userId: u.id,
          title,
          message,
        }));
        await db.insertInto("userNotifications").values(notificationValues).execute();
        console.log(`Inserted ${matchedUsers.length} in-app notifications for zone ${matchedZone.postcodePattern}`);
      } catch (err) {
        console.error("Failed to insert in-app notifications:", err);
      }

      console.log(`Zone ${matchedZone.id} (${matchedZone.postcodePattern}) reached activation threshold (${matchedUserCount}). Sending push notification...`);

      // 6. Use OneSignal REST API
      const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: matchedUserIds },
          target_channel: "push",
          headings: { en: title },
          contents: { en: message },
        }),
      });

      if (!oneSignalResponse.ok) {
        const errorBody = await oneSignalResponse.text();
        console.error(`OneSignal API error (${oneSignalResponse.status}) during zone activation notification:`, errorBody);
        return; // Don't log to DB if sending failed
      }

      // 7. Log to DB
      await db
        .insertInto("pushNotificationLog")
        .values({
          title: title,
          message: message,
          sentByAdminId: null, // System generated
        })
        .execute();

      console.log(`Zone activation push notification sent and logged successfully.`);
    }
  } catch (error) {
    // 8. Wrap in try/catch and log error safely without throwing
    console.error("Error in checkAndNotifyZoneActivation:", error);
  }
}