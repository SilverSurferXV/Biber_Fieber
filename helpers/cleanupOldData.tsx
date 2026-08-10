import { db } from "./db";

/**
 * Scheduled job to clean up old records from database tables to keep it lean.
 */
export const cleanupOldData = async (): Promise<void> => {
  console.log("[Scheduled Job] Starting cleanupOldData...");
  
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now - 730 * 24 * 60 * 60 * 1000);

  // 1. Cleanup old login attempts (> 30 days)
  try {
    const result = await db
      .deleteFrom("loginAttempts")
      .where("attemptedAt", "<", thirtyDaysAgo)
      .execute();
      
    const numDeleted = result.reduce((acc, r) => acc + Number(r.numDeletedRows || 0), 0);
    console.log(`[Scheduled Job] Cleaned up ${numDeleted} old login attempts.`);
  } catch (error) {
    console.error(
      "[Scheduled Job] Failed to clean up login attempts:", 
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // 2. Cleanup expired sessions (lastAccessed > 7 days)
  try {
    const result = await db
      .deleteFrom("sessions")
      .where("lastAccessed", "<", sevenDaysAgo)
      .execute();
      
    const numDeleted = result.reduce((acc, r) => acc + Number(r.numDeletedRows || 0), 0);
    console.log(`[Scheduled Job] Cleaned up ${numDeleted} expired sessions.`);
  } catch (error) {
    console.error(
      "[Scheduled Job] Failed to clean up sessions:", 
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // 3. Cleanup old analytics events (> 7 days)
  try {
    const result = await db
      .deleteFrom("analyticsEvents")
      .where("createdAt", "<", sevenDaysAgo)
      .execute();
      
    const numDeleted = result.reduce((acc, r) => acc + Number(r.numDeletedRows || 0), 0);
    console.log(`[Scheduled Job] Cleaned up ${numDeleted} old analytics events.`);
  } catch (error) {
    console.error(
      "[Scheduled Job] Failed to clean up analytics events:", 
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // 4. Cleanup old daily analytics (> 730 days)
  try {
    const result = await db
      .deleteFrom("analyticsDaily")
      .where("date", "<", twoYearsAgo)
      .execute();
      
    const numDeleted = result.reduce((acc, r) => acc + Number(r.numDeletedRows || 0), 0);
    console.log(`[Scheduled Job] Cleaned up ${numDeleted} old daily analytics.`);
  } catch (error) {
    console.error(
      "[Scheduled Job] Failed to clean up daily analytics:", 
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  console.log("[Scheduled Job] cleanupOldData completed.");
};