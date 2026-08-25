import { schema, OutputType } from "./reconcile-topups_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { stripeTopupReconcile } from "../../../helpers/stripeTopupReconcile";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await stripeTopupReconcile({
      days: input.days,
      dryRun: input.dryRun,
      paymentIntentIds: input.paymentIntentIds,
    });

    return new Response(
      superjson.stringify(result satisfies OutputType)
    );
  } catch (error: any) {
    console.error("Error in reconcile-topups_POST:", error);
    const status = error.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}