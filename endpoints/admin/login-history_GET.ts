import { schema, OutputType } from "./login-history_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sql } from "kysely";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { lookupIpGeolocations } from "../../helpers/lookupIpGeolocations";
import { pruneLoginAttempts } from "../../helpers/pruneLoginAttempts";

type LoginHistoryRow = {
  id: number;
  attemptedAt: Date | null;
  email: string;
  success: boolean | null;
  userId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  clientPlatform: string | null;
  loginSource: string | null;
  idBy: number | null;
  displayNameBy: string | null;
  firstNameBy: string | null;
  lastNameBy: string | null;
  roleBy: "admin" | "driver" | "user" | null;
  idEmail: number | null;
  displayNameEmail: string | null;
  firstNameEmail: string | null;
  lastNameEmail: string | null;
  roleEmail: "admin" | "driver" | "user" | null;
};

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") throw new Error("Forbidden");

   // Prune login attempts to keep only the newest 100 rows before querying
   await pruneLoginAttempts();

    const url = new URL(request.url);
    const input = schema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    const searchPattern = input.search ? `%${input.search}%` : null;

    let baseQuery = db
      .selectFrom("loginAttempts")
      .leftJoin("users as usersById", (join) =>
        join.onRef("usersById.id", "=", "loginAttempts.userId")
      )
      .leftJoin("users as usersByEmail", (join) =>
        join.on((eb) =>
          eb(sql`lower(users_by_email.email)`, "=", eb.ref("loginAttempts.email"))
        )
      );

    if (input.status === "success") {
      baseQuery = baseQuery.where("loginAttempts.success", "=", true);
    } else if (input.status === "failed") {
      baseQuery = baseQuery.where("loginAttempts.success", "=", false);
    }

    if (searchPattern) {
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb("loginAttempts.email", "ilike", searchPattern),
          eb("loginAttempts.ipAddress", "ilike", searchPattern),
          eb("usersById.firstName", "ilike", searchPattern),
          eb("usersById.lastName", "ilike", searchPattern),
          eb("usersById.email", "ilike", searchPattern),
          eb("usersByEmail.firstName", "ilike", searchPattern),
          eb("usersByEmail.lastName", "ilike", searchPattern),
          eb("usersByEmail.email", "ilike", searchPattern),
        ])
      );
    }

    const countQuery = baseQuery.select(db.fn.count("loginAttempts.id").as("total"));
    const [{ total }] = await countQuery.execute();

    const rowsQuery = baseQuery
      .select([
        "loginAttempts.id",
        "loginAttempts.attemptedAt",
        "loginAttempts.email",
        "loginAttempts.success",
        "loginAttempts.userId",
        "loginAttempts.ipAddress",
        "loginAttempts.userAgent",
        "loginAttempts.clientPlatform",
        "loginAttempts.loginSource",
        "usersById.id as idBy",
        "usersById.displayName as displayNameBy",
        "usersById.firstName as firstNameBy",
        "usersById.lastName as lastNameBy",
        "usersById.role as roleBy",
        "usersByEmail.id as idEmail",
        "usersByEmail.displayName as displayNameEmail",
        "usersByEmail.firstName as firstNameEmail",
        "usersByEmail.lastName as lastNameEmail",
        "usersByEmail.role as roleEmail",
      ])
      .orderBy("loginAttempts.attemptedAt", "desc")
      .orderBy("loginAttempts.id", "desc")
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
 
    const rows = await rowsQuery.execute();

    const ipsToLookup = rows.map((r) => r.ipAddress).filter(Boolean) as string[];
    const locations = await lookupIpGeolocations(ipsToLookup);

    const formattedRows = (rows as LoginHistoryRow[]).map((r) => {
      const loc = r.ipAddress ? locations.get(r.ipAddress) : null;
      return {
        id: r.id,
        attemptedAt: r.attemptedAt as Date | null,
        email: r.email,
        success: r.success,
        userId: r.userId ?? r.idBy ?? r.idEmail,
        displayName: r.displayNameBy ?? r.displayNameEmail ?? null,
        firstName: r.firstNameBy ?? r.firstNameEmail ?? null,
        lastName: r.lastNameBy ?? r.lastNameEmail ?? null,
        role: r.roleBy ?? r.roleEmail ?? null,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        clientPlatform: r.clientPlatform,
        loginSource: r.loginSource,
        location: loc || null,
      };
    });

    const output: OutputType = {
      rows: formattedRows,
      total: Number(total),
      page: input.page,
      pageSize: input.pageSize,
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: message === "Forbidden" ? 403 : 400,
    });
  }
}