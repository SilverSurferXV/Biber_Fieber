import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./my-ratings_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    let user;
    try {
      const sessionData = await getServerUserSession(request);
      user = sessionData.user;
    } catch (err) {
      if (err instanceof NotAuthenticatedError) {
        // As per requirements, return empty array if not authenticated
        return new Response(
          superjson.stringify({ ratings: [] } satisfies OutputType)
        );
      }
      throw err;
    }

    const ratings = await db
      .selectFrom("productRatings")
      .select(["productId", "tasteRating", "qualityRating", "priceRating"])
      .where("customerId", "=", user.id)
      .execute();

    const formattedRatings = ratings.map((r) => ({
      productId: Number(r.productId),
      tasteRating: r.tasteRating,
      qualityRating: r.qualityRating,
      priceRating: r.priceRating,
    }));

    return new Response(
      superjson.stringify({ ratings: formattedRatings } satisfies OutputType)
    );
  } catch (error) {
    const err = error as Error;
    return new Response(superjson.stringify({ error: err.message }), {
      status: 400,
    });
  }
}