import { PAYPAL_CLIENT_ID, PAYPAL_MODE } from "./_publicConfigs";

/**
 * Returns the correct PayPal API base URL based on the current mode setting.
 * @returns {string} The base URL for PayPal API requests.
 */
export const getPaypalBaseUrl = (): string => {
  const isLive = PAYPAL_MODE.toLowerCase().includes("live");
  return isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
};

/**
 * Fetches an access token from PayPal using client credentials.
 * This should only be called on the server side (endpoints).
 * @returns {Promise<string>} The PayPal access token.
 */
export const getPaypalAccessToken = async (): Promise<string> => {
  const clientId = PAYPAL_CLIENT_ID;
  const secretKey = process.env.PAYPAL_SECRET_KEY;

  if (!clientId || !secretKey) {
    throw new Error("Missing PayPal API credentials");
  }

  const baseUrl = getPaypalBaseUrl();
  const auth = Buffer.from(`${clientId}:${secretKey}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch PayPal access token: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("PayPal response did not contain an access_token");
  }

  return data.access_token as string;
};