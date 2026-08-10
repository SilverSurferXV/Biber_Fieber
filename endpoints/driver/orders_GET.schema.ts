import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Orders, Users, OrderItems } from '../../helpers/schema';

export const schema = z.object({});

export type DriverOrder = Pick<
  Selectable<Orders>,
  "id" |
  "orderNumber" |
  "status" |
  "total" |
  "deliveryFee" |
  "subtotal" |
  "deliveryNote" |
  "createdAt" |
  "deliveryDate" |
  "preferredDeliveryDay"> &
{
  customer: Pick<
    Selectable<Users>,
    "firstName" |
    "lastName" |
    "streetAddress" |
    "city" |
    "postcode" |
    "mobileNumber" |
    "dropoffDescription" |
    "dropoffPhotoUrl">;

  items: Pick<Selectable<OrderItems>, "productName" | "quantity" | "unitPrice">[];
};

export type DriverAddress = {
  streetAddress: string | null;
  city: string | null;
  postcode: string | null;
};

export type OutputType = {
  orders: DriverOrder[];
  driverAddress: DriverAddress;
  assignedPostcodes: string[];
};

export const getDriverOrders = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/driver/orders`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch driver orders");
  }

  return superjson.parse<OutputType>(await result.text());
};