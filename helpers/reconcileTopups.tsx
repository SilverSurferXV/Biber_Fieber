import { stripeTopupReconcile } from "./stripeTopupReconcile";

export async function reconcileTopups(): Promise<void> {
  try {
    const result = await stripeTopupReconcile({
      days: 2,
      dryRun: false,
    });
    
    console.log(`[Scheduled Job] Reconciled Stripe topups: Checked ${result.checked}, Credited ${result.credited}.`);
  } catch (error) {
    console.error("[Scheduled Job] Failed to reconcile Stripe topups:", error);
  }
}