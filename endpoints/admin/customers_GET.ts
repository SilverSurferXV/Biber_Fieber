import { schema, OutputType } from "./customers_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

    const url = new URL(request.url);
    const input = schema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      businessOnly: url.searchParams.get("businessOnly") ?? undefined,
      excludeBusiness: url.searchParams.get("excludeBusiness") ?? undefined,
    });

    const searchPattern = input.search ? `%${input.search}%` : null;

    let countQuery = db
      .selectFrom("users")
      .select(db.fn.countAll().as("total"))
      .where("role", "in", ["user", "admin"]);

    if (input.businessOnly) {
      countQuery = countQuery.where((eb) => eb.and([eb("companyName", "is not", null), eb("companyName", "!=", "")]));
    }

    if (input.excludeBusiness) {
      countQuery = countQuery.where((eb) => eb.or([eb("companyName", "is", null), eb("companyName", "=", "")]));
    }

    if (searchPattern) {
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("firstName", "ilike", searchPattern),
          eb("lastName", "ilike", searchPattern),
          eb("email", "ilike", searchPattern),
          eb("postcode", "ilike", searchPattern),
          eb("city", "ilike", searchPattern),
          eb("bibercode", "ilike", searchPattern),
        ])
      );
    }

    const [{ total }] = await countQuery.execute();

    let customersQuery = db
      .selectFrom("users")
      .select([
        "id",
        "salutation",
        "displayName",
        "firstName",
        "lastName",
        "email",
        "emailVerified",
        "streetAddress",
        "city",
        "postcode",
        "mobileNumber",
        "languagePreference",
        "notificationPreference",
        "pointsBalance",
        "bibercode",
        "referredByBibercode",
        "role",
        "active",
        "createdAt",
        "updatedAt",
        "dateOfBirth",
        "companyName",
        "dropoffDescription",
        "dropoffPhotoUrl",
      ])
      .where("role", "in", ["user", "admin"]);

    if (input.businessOnly) {
      customersQuery = customersQuery.where((eb) => eb.and([eb("companyName", "is not", null), eb("companyName", "!=", "")]));
    }

    if (input.excludeBusiness) {
      customersQuery = customersQuery.where((eb) => eb.or([eb("companyName", "is", null), eb("companyName", "=", "")]));
    }

    if (searchPattern) {
      customersQuery = customersQuery.where((eb) =>
        eb.or([
          eb("firstName", "ilike", searchPattern),
          eb("lastName", "ilike", searchPattern),
          eb("email", "ilike", searchPattern),
          eb("postcode", "ilike", searchPattern),
          eb("city", "ilike", searchPattern),
          eb("bibercode", "ilike", searchPattern),
        ])
      );
    }

    const customers = await customersQuery
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    const mappedCustomers = customers.map((c) => ({
      ...c,
      avatarUrl: null as null,
      pointsBalance: c.pointsBalance != null ? Number(c.pointsBalance) : null,
    })) as OutputType["customers"];

    const totalCount = Number(total);
    const output: OutputType = {
      customers: mappedCustomers,
      totalCount,
      page: input.page,
      totalPages: Math.ceil(totalCount / input.limit),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}