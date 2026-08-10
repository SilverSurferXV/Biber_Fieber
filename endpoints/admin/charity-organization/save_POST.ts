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

    let id = input.id;
    if (id) {
      await db
        .updateTable("charityOrganizations")
        .set({
          name: input.name,
          description: input.description ?? null,
          active: input.active,
          streetAddress: input.streetAddress ?? null,
          postcode: input.postcode ?? null,
          city: input.city ?? null,
          bankDetails: input.bankDetails ?? null,
          contactPerson: input.contactPerson ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          registerNumber: input.registerNumber ?? null,
          logoUrl: input.logoUrl ?? null,
          updatedAt: new Date(),
        })
        .where("id", "=", id)
        .execute();
    } else {
      const res = await db
        .insertInto("charityOrganizations")
        .values({
          name: input.name,
          description: input.description ?? null,
          active: input.active,
          streetAddress: input.streetAddress ?? null,
          postcode: input.postcode ?? null,
          city: input.city ?? null,
          bankDetails: input.bankDetails ?? null,
          contactPerson: input.contactPerson ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
         registerNumber: input.registerNumber ?? null,
         logoUrl: input.logoUrl ?? null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      id = res.id;
    }

    return new Response(
      superjson.stringify({ success: true, id } satisfies OutputType)
    );
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: error.message === "Forbidden" ? 403 : 400,
    });
  }
}