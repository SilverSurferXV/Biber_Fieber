import { db } from '../../../helpers/db';
import { schema, OutputType } from "./save_POST.schema";
import { generatePasswordHash } from '../../../helpers/generatePasswordHash';
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const displayName = `${input.firstName} ${input.lastName}`;

    if (input.id) {
      // Check if trying to change email to an existing one
      const existingUser = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", input.email)
        .where("id", "!=", input.id)
        .limit(1)
        .execute();

      if (existingUser.length > 0) {
        return new Response(superjson.stringify({ error: "Email already in use" }), { status: 409 });
      }

      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("users")
          .set({
            firstName: input.firstName,
            lastName: input.lastName,
            displayName,
            email: input.email,
            mobileNumber: input.mobileNumber || null,
            billingCompanyName: input.billingCompanyName || null,
            billingStreet: input.billingStreet || null,
            billingCity: input.billingCity || null,
            billingPostcode: input.billingPostcode || null,
            billingCountry: input.billingCountry || null,
            billingTaxNumber: input.billingTaxNumber || null,
            packagingCompensation: input.packagingCompensation ?? 0,
            stopCompensation: input.stopCompensation ?? 0,
            invoiceCompanyName: input.invoiceCompanyName || null,
            invoiceStreet: input.invoiceStreet || null,
            invoiceHouseNumber: input.invoiceHouseNumber || null,
            invoicePostcode: input.invoicePostcode || null,
            invoiceCity: input.invoiceCity || null,
            invoiceTaxId: input.invoiceTaxId || null,
            invoiceTaxNumber: input.invoiceTaxNumber || null,
            vatEligible: input.vatEligible ?? false,
            iban: input.iban || null,
            updatedAt: new Date()
          })
          .where("id", "=", input.id as number)
          .where("role", "=", "driver")
          .execute();

        if (input.password) {
          const passwordHash = await generatePasswordHash(input.password);

          // Check if password entry exists, update or insert
          const pwdEntry = await trx
            .selectFrom("userPasswords")
            .select("id")
            .where("userId", "=", input.id as number)
            .execute();

          if (pwdEntry.length > 0) {
            await trx
              .updateTable("userPasswords")
              .set({ passwordHash })
              .where("userId", "=", input.id as number)
              .execute();
          } else {
            await trx
              .insertInto("userPasswords")
              .values({ userId: input.id as number, passwordHash })
              .execute();
          }
        }
      });

      return new Response(
        superjson.stringify({ success: true, userId: input.id } satisfies OutputType),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Create new driver
      if (!input.password) {
        return new Response(superjson.stringify({ error: "Password is required for new drivers" }), { status: 400 });
      }

      const existingUser = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", input.email)
        .limit(1)
        .execute();

      if (existingUser.length > 0) {
        return new Response(superjson.stringify({ error: "Email already in use" }), { status: 409 });
      }

      const passwordHash = await generatePasswordHash(input.password);

      const newUser = await db.transaction().execute(async (trx) => {
        const [insertedUser] = await trx
          .insertInto("users")
          .values({
            email: input.email,
            displayName,
            firstName: input.firstName,
            lastName: input.lastName,
            role: "driver",
            emailVerified: true,
            mobileNumber: input.mobileNumber || null,
            billingCompanyName: input.billingCompanyName || null,
            billingStreet: input.billingStreet || null,
            billingCity: input.billingCity || null,
            billingPostcode: input.billingPostcode || null,
            billingCountry: input.billingCountry || null,
            billingTaxNumber: input.billingTaxNumber || null,
            packagingCompensation: input.packagingCompensation ?? 0,
            stopCompensation: input.stopCompensation ?? 0,
            invoiceCompanyName: input.invoiceCompanyName || null,
            invoiceStreet: input.invoiceStreet || null,
            invoiceHouseNumber: input.invoiceHouseNumber || null,
            invoicePostcode: input.invoicePostcode || null,
            invoiceCity: input.invoiceCity || null,
            invoiceTaxId: input.invoiceTaxId || null,
            invoiceTaxNumber: input.invoiceTaxNumber || null,
            vatEligible: input.vatEligible ?? false,
            iban: input.iban || null,
          })
          .returning(["id"])
          .execute();

        await trx
          .insertInto("userPasswords")
          .values({
            userId: insertedUser.id,
            passwordHash
          })
          .execute();

        return insertedUser;
      });

      return new Response(
        superjson.stringify({ success: true, userId: newUser.id } satisfies OutputType),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Admin driver save error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400
    });
  }
}