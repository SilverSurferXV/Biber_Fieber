import superjson from "superjson";
import Stripe from "stripe";
import { OutputType, StripePaymentMethodConfigurationDetail, StripePaymentMethodDomain, StripePaymentMethodDomainDetail } from "./status_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    await stripe.balance.retrieve();

    let paymentMethodDomains: StripePaymentMethodDomain[] = [];
    let paymentMethodDomainDetails: StripePaymentMethodDomainDetail[] = [];
    let livemode: boolean | undefined;

    try {
      const domains = await stripe.paymentMethodDomains.list({ limit: 20 });
      if (domains.data.length > 0) {
        livemode = domains.data[0].livemode;
      }
      paymentMethodDomains = domains.data.map((domain) => ({
        domainName: domain.domain_name,
        enabled: domain.enabled,
        applePay: String(domain.apple_pay?.status ?? "unknown"),
        googlePay: String(domain.google_pay?.status ?? "unknown"),
        link: String(domain.link?.status ?? "unknown"),
        paypal: String(domain.paypal?.status ?? "unknown"),
      }));
      paymentMethodDomainDetails = domains.data.map((domain) => ({
        domainName: domain.domain_name,
        enabled: domain.enabled,
         applePay: {
           status: String(domain.apple_pay?.status ?? "unknown"),
           statusDetails: domain.apple_pay?.status_details ? { ...domain.apple_pay.status_details } : null,
         },
         googlePay: {
           status: String(domain.google_pay?.status ?? "unknown"),
           statusDetails: domain.google_pay?.status_details ? { ...domain.google_pay.status_details } : null,
         },
         link: {
           status: String(domain.link?.status ?? "unknown"),
           statusDetails: domain.link?.status_details ? { ...domain.link.status_details } : null,
         },
         paypal: {
           status: String(domain.paypal?.status ?? "unknown"),
           statusDetails: domain.paypal?.status_details ? { ...domain.paypal.status_details } : null,
         },
   }));
    } catch (domainError) {
      console.error("Failed to fetch Stripe payment method domains:", domainError instanceof Error ? domainError.message : domainError);
    }

    let paymentMethodConfigurations: StripePaymentMethodConfigurationDetail[] = [];
    try {
      const configs = await stripe.paymentMethodConfigurations.list({ limit: 20 });
      const extractPreference = (wallet: { display_preference?: { preference?: string | null; value?: string | null } } | undefined): { preference: string; value: string } => {
        if (wallet && wallet.display_preference) {
          return {
            preference: String(wallet.display_preference.preference ?? "unknown"),
            value: String(wallet.display_preference.value ?? "unknown"),
          };
        }
        return { preference: "unknown", value: "unknown" };
      };

      paymentMethodConfigurations = configs.data.map((config) => ({
        id: config.id,
        name: config.name,
        isDefault: config.parent === null,
        applePay: extractPreference(config.apple_pay),
        googlePay: extractPreference(config.google_pay),
        link: extractPreference(config.link),
        card: extractPreference(config.card),
      }));
    } catch (configError) {
      console.error("Failed to fetch Stripe payment method configurations:", configError instanceof Error ? configError.message : configError);
    }

    if (livemode === undefined) {
      try {
        const balance = await stripe.balance.retrieve();
        livemode = balance.livemode;
      } catch (e) {}
    }

    return new Response(
      superjson.stringify({ connected: true, livemode, paymentMethodDomains, paymentMethodDomainDetails, paymentMethodConfigurations } satisfies OutputType)
    );
  } catch (error: any) {
    if (error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return new Response(
      superjson.stringify({ connected: false, error: error.message } satisfies OutputType)
    );
  }
}