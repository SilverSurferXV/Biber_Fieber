import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./submit_POST.schema";
import superjson from 'superjson';

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Check if the user has already rated this product
    const existing = await db.selectFrom("productRatings")
      .select("id")
      .where("productId", "=", input.productId)
      .where("customerId", "=", user.id)
      .executeTakeFirst();

    if (existing) {
      // Update existing rating
      await db.updateTable("productRatings")
        .set({
          tasteRating: input.tasteRating,
          qualityRating: input.qualityRating,
          priceRating: input.priceRating,
          submittedAt: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();
    } else {
      // Insert new rating
      await db.insertInto("productRatings")
        .values({
          productId: input.productId,
          customerId: user.id,
          tasteRating: input.tasteRating,
          qualityRating: input.qualityRating,
          priceRating: input.priceRating,
          submittedAt: new Date(),
        })
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const err = error as Error;
    return new Response(superjson.stringify({ error: err.message }), { status: 400 });
  }
}