import type { PagePrefetchFn } from "@floot/prefetch";
import { getSettingsFromDb } from "../helpers/shopDataServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  await qc.prefetchQuery({ queryKey: ["shop", "settings"], queryFn: () => getSettingsFromDb() });
  return { maxAge: 180 };
}