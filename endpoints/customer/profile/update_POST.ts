import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Validate delivery postcode is in an active delivery zone
    // Only run when deliveryAddressSameAsBilling is explicitly false AND deliveryPostcode is provided
    if (input.deliveryAddressSameAsBilling === false && input.deliveryPostcode) {
      const activeZones = await db
        .selectFrom("deliveryZones")
        .where("active", "=", true)
        .selectAll()
        .execute();

      const matchedZone = activeZones.find((zone) => {
        const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
        return new RegExp(regexStr).test(input.deliveryPostcode!);
      });

      if (!matchedZone) {
        throw new Error("Die Lieferadresse liegt außerhalb unseres Liefergebiets. Bitte wähle eine PLZ innerhalb unseres Liefergebiets.");
      }
    }

    // Build update object conditionally - only include fields that are actually provided
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.streetAddress !== undefined) updateData.streetAddress = input.streetAddress;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.postcode !== undefined) updateData.postcode = input.postcode;
    if (input.mobileNumber !== undefined) updateData.mobileNumber = input.mobileNumber;
    if (input.languagePreference !== undefined) updateData.languagePreference = input.languagePreference;
    if (input.notificationPreference !== undefined) updateData.notificationPreference = input.notificationPreference;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
    if (input.dropoffDescription !== undefined) updateData.dropoffDescription = input.dropoffDescription;
    if (input.dropoffPhotoUrl !== undefined) updateData.dropoffPhotoUrl = input.dropoffPhotoUrl;
    if (input.salutation !== undefined) updateData.salutation = input.salutation;
    if (input.companyName !== undefined) updateData.companyName = input.companyName;
    if (input.newsletterOptIn !== undefined) updateData.newsletterOptIn = input.newsletterOptIn;
    if (input.deliveryAddressSameAsBilling !== undefined) updateData.deliveryAddressSameAsBilling = input.deliveryAddressSameAsBilling;
    if (input.deliveryCompanyName !== undefined) updateData.deliveryCompanyName = input.deliveryCompanyName;
    if (input.deliveryFirstName !== undefined) updateData.deliveryFirstName = input.deliveryFirstName;
    if (input.deliveryLastName !== undefined) updateData.deliveryLastName = input.deliveryLastName;
    if (input.deliveryStreet !== undefined) updateData.deliveryStreet = input.deliveryStreet;
    if (input.deliveryPostcode !== undefined) updateData.deliveryPostcode = input.deliveryPostcode;
    if (input.deliveryCity !== undefined) updateData.deliveryCity = input.deliveryCity;
    if (input.deliveryMobileNumber !== undefined) updateData.deliveryMobileNumber = input.deliveryMobileNumber;

    await db
      .updateTable("users")
      .set(updateData)
      .where("id", "=", user.id)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}