import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const now = new Date();
    let savedSignature;

    if (input.id) {
      savedSignature = await db
        .updateTable("emailSignatures")
        .set({
          name: input.name,
          content: input.content,
          updatedAt: now,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      savedSignature = await db
        .insertInto("emailSignatures")
        .values({
          name: input.name,
          content: input.content,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(superjson.stringify(savedSignature satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}