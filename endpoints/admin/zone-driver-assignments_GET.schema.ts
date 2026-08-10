import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { ZoneDriverAssignments } from '../../helpers/schema';

export const schema = z.object({});

export type OutputType = Selectable<ZoneDriverAssignments>[];

export const getZoneDriverAssignments = async (
dateKeys?: string,
init?: RequestInit)
: Promise<OutputType> => {
  const url = dateKeys ?
  `/_api/admin/zone-driver-assignments?dateKeys=${encodeURIComponent(
    dateKeys
  )}` :
  `/_api/admin/zone-driver-assignments`;
  const result = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch driver assignments");
  }

  return superjson.parse<OutputType>(await result.text());
};