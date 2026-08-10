import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { getProductsFromDb } from "../../helpers/shopDataServer";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const catParam = url.searchParams.get("categoryId");
    const input = schema.parse({
      categoryId: catParam ? Number(catParam) : undefined,
    });

    const output: OutputType = await getProductsFromDb(input.categoryId);

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}