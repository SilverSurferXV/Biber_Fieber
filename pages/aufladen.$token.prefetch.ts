import type { PagePrefetchFn } from "@floot/prefetch"

export const prefetch: PagePrefetchFn = async (ctx) => {
  return { maxAge: 0 };
}