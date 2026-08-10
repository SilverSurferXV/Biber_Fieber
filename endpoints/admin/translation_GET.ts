import { schema, OutputType, EnabledLanguagesType } from "./translation_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const row = await db
      .selectFrom("appSettings")
      .select("enabledLanguages")
      .limit(1)
      .executeTakeFirst();

    const defaultLanguages: EnabledLanguagesType = {
      en: false,
      es: false,
      it: false,
      tr: false,
    };

    let currentLanguages = defaultLanguages;
    if (row?.enabledLanguages) {
      const stored = row.enabledLanguages as Record<string, any>;
      currentLanguages = {
        en: !!stored.en,
        es: !!stored.es,
        it: !!stored.it,
        tr: !!stored.tr,
      };
    }

    return new Response(
      superjson.stringify({
        enabledLanguages: currentLanguages,
      } satisfies OutputType)
    );
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}