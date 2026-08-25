import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type StripePaymentMethodConfigurationDisplayPreference = {
  preference: string;
  value: string;
};

export type StripePaymentMethodConfigurationDetail = {
  id: string;
  name: string;
  isDefault: boolean;
  applePay: StripePaymentMethodConfigurationDisplayPreference;
  googlePay: StripePaymentMethodConfigurationDisplayPreference;
  link: StripePaymentMethodConfigurationDisplayPreference;
  card: StripePaymentMethodConfigurationDisplayPreference;
};

export type StripePaymentMethodDomain = {
  domainName: string;
  enabled: boolean;
  applePay: string;
  googlePay: string;
  link: string;
  paypal: string;
};

 export type StripePaymentMethodDomainDetail = {
   domainName: string;
   enabled: boolean;
  applePay: {
     status: string;
    statusDetails: Record<string, unknown> | null;
   };
   googlePay: {
     status: string;
    statusDetails: Record<string, unknown> | null;
   };
   link: {
     status: string;
    statusDetails: Record<string, unknown> | null;
   };
   paypal: {
     status: string;
    statusDetails: Record<string, unknown> | null;
   };
 };

export type OutputType = 
  | { connected: true; livemode?: boolean; paymentMethodDomains?: StripePaymentMethodDomain[]; paymentMethodDomainDetails?: StripePaymentMethodDomainDetail[]; paymentMethodConfigurations?: StripePaymentMethodConfigurationDetail[] }
  | { connected: false; error: string };

export const getStripeStatus = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stripe/status`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};