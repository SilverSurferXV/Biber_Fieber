import type { PagePrefetchFn } from "@floot/prefetch";
import { getSettingsFromDb, getCategoriesFromDb, getProductsFromDb } from "../helpers/shopDataServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  await Promise.all([
    qc.prefetchQuery({ queryKey: ["shop", "settings"], queryFn: () => getSettingsFromDb() }),
    qc.prefetchQuery({ queryKey: ["shop", "categories"], queryFn: () => getCategoriesFromDb() }),
    qc.prefetchQuery({ queryKey: ["shop", "products", undefined], queryFn: () => getProductsFromDb() }),
  ]);
  return { maxAge: 480 };
}