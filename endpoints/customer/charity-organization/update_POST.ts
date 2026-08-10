import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const currentUser = await db
      .selectFrom("users")
      .select(["referredByBibercode"])
      .where("id", "=", user.id)
      .executeTakeFirst();

    if (currentUser?.referredByBibercode) {
      throw new Error(
        "Du kannst keine Spendenorganisation wählen, da du einen Biber Code bei der Registrierung angegeben hast."
      );
    }

    await db
      .updateTable("users")
      .set({ charityOrganizationId: input.charityOrganizationId })
      .where("id", "=", user.id)
      .execute();

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: error.name === "NotAuthenticatedError" ? 401 : 400,
    });
  }
}