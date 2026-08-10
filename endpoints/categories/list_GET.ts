import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { getCategoriesFromDb } from "../../helpers/shopDataServer";

export async function handle(request: Request) {
  try {
    const categories = await getCategoriesFromDb();

    return new Response(superjson.stringify(categories satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}