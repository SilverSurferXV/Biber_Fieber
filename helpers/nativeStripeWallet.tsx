import { STRIPE_PUBLISHABLE_KEY } from "./_publicConfigs";
import { isNativeApp } from "./isNativeApp";
import { getClientPlatform } from "./getClientPlatform";

// NOTE: This exact Apple Merchant ID must be created in the Apple Developer portal 
// and selected in the Xcode Apple Pay capability.
const MERCHANT_IDENTIFIER = "merchant.com.silversurfer.biberfieber";

// NOTE: For Google Pay, the plugin uses the merchantIdentifier field as the displayed merchant name.
const GOOGLE_PAY_MERCHANT_NAME = "Biber Fieber";

// Loose typings for the Capacitor Stripe plugin so we don't need to import the npm package
interface CapacitorStripePlugin {
  initialize(options: { publishableKey: string }): Promise<void>;
  isApplePayAvailable(): Promise<void>;
  isGooglePayAvailable(): Promise<void>;
  createApplePay(options: any): Promise<void>;
  presentApplePay(): Promise<{ paymentResult: string }>;
  createGooglePay(options: any): Promise<void>;
  presentGooglePay(): Promise<{ paymentResult: string }>;
}

let stripePlugin: CapacitorStripePlugin | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Accesses the Capacitor Stripe plugin dynamically from the global window object.
 */
function getPlugin(): CapacitorStripePlugin | null {
  if (stripePlugin) return stripePlugin;
  if (typeof window === "undefined" || !isNativeApp()) return null;

  try {
    // Capacitor injects itself globally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Capacitor = (window as any).Capacitor;
    if (!Capacitor) return null;

    if (Capacitor.Plugins?.Stripe) {
      stripePlugin = Capacitor.Plugins.Stripe;
      return stripePlugin;
    }

    if (typeof Capacitor.registerPlugin === "function") {
      stripePlugin = Capacitor.registerPlugin("Stripe");
      return stripePlugin;
    }
  } catch (error) {
    console.error("Failed to get Stripe plugin from Capacitor", error);
  }
  
  return null;
}

/**
 * Initializes the Stripe plugin with the publishable key exactly once.
 */
function initialize(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return Promise.resolve();

  if (!initializationPromise) {
    initializationPromise = plugin.initialize({ publishableKey: STRIPE_PUBLISHABLE_KEY }).catch((error) => {
      console.error("Failed to initialize Stripe plugin", error);
      // reset promise so we can retry on next call if it failed
      initializationPromise = null;
    });
  }

  return initializationPromise;
}

export const nativeStripeWallet = {
  /**
   * Checks if native Apple Pay / Google Pay wallets are available on the device.
   */
  async getAvailability(): Promise<{ applePay: boolean; googlePay: boolean; pluginAvailable: boolean }> {
    const plugin = getPlugin();
    if (!plugin) {
      console.log("[nativeStripeWallet] Plugin not found in native build, browser handoff will be used.");
      return { applePay: false, googlePay: false, pluginAvailable: false };
    }

    await initialize();

    const platform = getClientPlatform();
    let applePay = false;
    let googlePay = false;

    // Check Apple Pay availability only on iOS
    if (platform === "ios-app") {
      try {
        await plugin.isApplePayAvailable();
        applePay = true;
      } catch (error) {
        applePay = false;
      }
    }

    // Check Google Pay availability only on Android
    if (platform === "android-app") {
      try {
        await plugin.isGooglePayAvailable();
        googlePay = true;
      } catch (error) {
        googlePay = false;
      }
    }

    const result = { applePay, googlePay, pluginAvailable: true };
    console.log("[nativeStripeWallet] getAvailability result:", { ...result, platform });
    return result;
  },

  /**
   * Triggers the native payment sheet for Apple Pay or Google Pay.
   */
  async pay(args: {
    kind: "apple_pay" | "google_pay";
    clientSecret: string;
    amount: number;
    label: string;
  }): Promise<"completed" | "canceled" | "failed"> {
    const plugin = getPlugin();
    if (!plugin) {
      console.error("Stripe plugin not available for payment");
      return "failed";
    }

    await initialize();

    try {
      if (args.kind === "apple_pay") {
        await plugin.createApplePay({
          paymentIntentClientSecret: args.clientSecret,
          paymentSummaryItems: [{ label: args.label, amount: args.amount }],
          merchantIdentifier: MERCHANT_IDENTIFIER,
          countryCode: "DE",
          currency: "EUR",
        });

        const result = await plugin.presentApplePay();
        const paymentResult = result.paymentResult;
        
        if (paymentResult === "applePayCompleted" || paymentResult === "Completed") return "completed";
        if (paymentResult === "applePayCanceled" || paymentResult === "Canceled") return "canceled";
        
        console.error("Apple Pay failed or returned unknown status:", paymentResult);
        return "failed";
      } else if (args.kind === "google_pay") {
        await plugin.createGooglePay({
          paymentIntentClientSecret: args.clientSecret,
          paymentSummaryItems: [{ label: args.label, amount: args.amount }],
          merchantIdentifier: GOOGLE_PAY_MERCHANT_NAME,
          countryCode: "DE",
          currency: "EUR",
          isTesting: STRIPE_PUBLISHABLE_KEY.startsWith("pk_test"),
        });

        const result = await plugin.presentGooglePay();
        const paymentResult = result.paymentResult;
        
        if (paymentResult === "googlePayCompleted" || paymentResult === "Completed") return "completed";
        if (paymentResult === "googlePayCanceled" || paymentResult === "Canceled") return "canceled";
        
        console.error("Google Pay failed or returned unknown status:", paymentResult);
        return "failed";
      }
    } catch (error) {
      console.error(`Failed to process native payment for ${args.kind}:`, error);
      return "failed";
    }

    return "failed";
  },
};