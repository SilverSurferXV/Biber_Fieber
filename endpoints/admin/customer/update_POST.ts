import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { generatePasswordHash } from "../../../helpers/generatePasswordHash";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db
      .updateTable("users")
      .set({
        salutation: input.salutation !== undefined ? input.salutation : undefined,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        streetAddress: input.streetAddress,
        city: input.city,
        postcode: input.postcode,
        mobileNumber: input.mobileNumber,
        notificationPreference: input.notificationPreference,
        languagePreference: input.languagePreference,
        pointsBalance: input.pointsBalance?.toString(),
        dateOfBirth: input.dateOfBirth !== undefined ? (input.dateOfBirth ? new Date(input.dateOfBirth) : null) : undefined,
        updatedAt: new Date(),
      })
      .where("id", "=", input.userId)
      .execute();

    if (input.newPassword) {
      const passwordHash = await generatePasswordHash(input.newPassword);
      const existing = await db
        .selectFrom("userPasswords")
        .select("id")
        .where("userId", "=", input.userId)
        .limit(1)
        .execute();

      if (existing.length > 0) {
        await db
          .updateTable("userPasswords")
          .set({ passwordHash })
          .where("userId", "=", input.userId)
          .execute();
      } else {
        await db
          .insertInto("userPasswords")
          .values({ userId: input.userId, passwordHash })
          .execute();
      }
      console.log(`Admin updated password for userId=${input.userId}`);
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.message === "Forbidden" ? 403 : 400 });
  }
}