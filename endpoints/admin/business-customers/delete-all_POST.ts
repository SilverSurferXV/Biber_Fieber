import { schema, OutputType } from "./delete-all_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import bcrypt from "bcryptjs";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      console.error("Non-admin user attempted to delete all business customers");
      return new Response(superjson.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Get admin password hash
    const adminPasswordRow = await db
      .selectFrom("userPasswords")
      .select("passwordHash")
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!adminPasswordRow) {
      console.error(`No password found for admin user ${user.id}`);
      return new Response(superjson.stringify({ error: "Falsches Passwort" }), { status: 401 });
    }

    const isPasswordCorrect = await bcrypt.compare(input.password, adminPasswordRow.passwordHash);

    if (!isPasswordCorrect) {
      console.error(`Incorrect password for admin user ${user.id}`);
      return new Response(superjson.stringify({ error: "Falsches Passwort" }), { status: 401 });
    }

    // Find all non-admin business users
    const nonAdminUsers = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where("role", "!=", "admin")
      .where("companyName", "is not", null)
      .where("companyName", "!=", "")
      .execute();

    if (nonAdminUsers.length === 0) {
      return new Response(superjson.stringify({ success: true, deletedCount: 0 } satisfies OutputType));
    }

    const nonAdminUserIds = nonAdminUsers.map((u) => u.id);
    const nonAdminEmails = nonAdminUsers.map((u) => u.email);

    // Execute deletions in a transaction to ensure data integrity
    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // Delete dependent rows first to prevent foreign key constraint violations
      
      // Delete from driverDeliveryRatings (FK to orders and users with NO ACTION)
      await trx
        .deleteFrom("driverDeliveryRatings")
        .where((eb) =>
          eb.or([
            eb("customerId", "in", nonAdminUserIds),
            eb("driverId", "in", nonAdminUserIds)
          ])
        )
        .execute();

      // Delete from driverTips (FK to orders and users with NO ACTION)
      await trx
        .deleteFrom("driverTips")
        .where((eb) =>
          eb.or([
            eb("customerId", "in", nonAdminUserIds),
            eb("driverId", "in", nonAdminUserIds)
          ])
        )
        .execute();

      await trx
        .deleteFrom("sessions")
        .where("userId", "in", nonAdminUserIds)
        .execute();

      await trx
        .deleteFrom("pointTransactions")
        .where("customerId", "in", nonAdminUserIds)
        .execute();

      await trx
        .deleteFrom("orders")
        .where((eb) =>
          eb.or([
            eb("customerId", "in", nonAdminUserIds),
            eb("deliveryDriverId", "in", nonAdminUserIds),
            eb("packerDriverId", "in", nonAdminUserIds)
          ])
        )
        .execute();

      if (nonAdminEmails.length > 0) {
        await trx
          .deleteFrom("loginAttempts")
          .where("email", "in", nonAdminEmails)
          .execute();
      }

      // Other dependent tables that might need cleanup for non-admin users
      await trx
        .deleteFrom("userPasswords")
        .where("userId", "in", nonAdminUserIds)
        .execute();

      // Finally, delete the users
      await trx
        .deleteFrom("users")
        .where("id", "in", nonAdminUserIds)
        .execute();
    });

    return new Response(superjson.stringify({ success: true, deletedCount: nonAdminUsers.length } satisfies OutputType));
  } catch (error: any) {
    console.error("Error in delete-all_POST:", error);
    return new Response(
      superjson.stringify({ error: error.message || "An unexpected error occurred" }),
      { status: 400 }
    );
  }
}