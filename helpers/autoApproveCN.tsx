import { db } from "./db";

/**
 * Scheduled job helper to auto-approve pending credit notes that have expired.
 */
export const autoApproveCN = async (): Promise<void> => {
  try {
    const now = new Date();
    
    const result = await db
      .updateTable("driverCreditNotes")
      .set({
        status: "approved_auto",
        approvedAt: now,
      })
      .where("status", "=", "pending")
      .where("expiresAt", "<=", now)
      .returning("id")
      .execute();

    if (result.length > 0) {
      console.log(`[Scheduled Job] Successfully auto-approved ${result.length} expired credit notes.`);
    } else {
      console.log(`[Scheduled Job] No expired pending credit notes found to auto-approve.`);
    }
  } catch (error) {
    console.error("[Scheduled Job] Failed to auto-approve credit notes:", error instanceof Error ? error.message : "Unknown error");
  }
};