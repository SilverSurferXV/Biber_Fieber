 import { OutputType } from "./settings_GET.schema";
 import superjson from "superjson";
 import { getSettingsFromDb } from '../helpers/shopDataServer';
import { logNativeRequestProbe } from "../helpers/logNativeRequestProbe";
 
 export async function handle(request: Request) {
  // TEMPORARY DIAGNOSTIC: Probe native app requests
  logNativeRequestProbe(request, "settings-public");

   try {
     const output: OutputType = await getSettingsFromDb();
 
    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}