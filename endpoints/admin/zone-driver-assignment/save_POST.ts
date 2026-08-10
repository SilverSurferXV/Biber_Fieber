import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from '../../../helpers/db';
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    const packer = result.packer ?? 'zentrale';

    await sql`
      INSERT INTO zone_driver_assignments (date_key, postcode, driver_id, car_type, packer, updated_at)
      VALUES (${result.dateKey}, ${result.postcode}, ${result.driverId}, ${result.carType}, ${packer}, NOW())
      ON CONFLICT (date_key, postcode)
      DO UPDATE SET driver_id = EXCLUDED.driver_id, car_type = EXCLUDED.car_type, packer = EXCLUDED.packer, updated_at = NOW()
    `.execute(db);

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
    error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400
    });
  }
}