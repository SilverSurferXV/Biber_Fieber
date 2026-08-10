import { schema, OutputType } from "./checkout_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sendMailjetEmail } from "../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../helpers/replaceTemplateVars";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const dbUser = await db.selectFrom("users").selectAll().where("id", "=", user.id).executeTakeFirst();

    // Determine which postcode to use for zone validation
    const effectivePostcode = (dbUser?.deliveryAddressSameAsBilling === false && dbUser.deliveryPostcode)
      ? dbUser.deliveryPostcode
      : dbUser?.postcode;

    if (!dbUser || !effectivePostcode) {
      throw new Error("Please add your postcode in your account before ordering.");
    }

    const zones = await db.selectFrom("deliveryZones").selectAll().where("active", "=", true).execute();
    const zone = zones.find((z) => {
      const regexStr = "^" + z.postcodePattern.replace(/\*/g, ".*") + "$";
      return new RegExp(regexStr).test(effectivePostcode);
    });
    if (!zone) {
      throw new Error("Sorry, we do not deliver to your postcode yet.");
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await db.selectFrom("products").selectAll().where("id", "in", productIds).where("active", "=", true).execute();
    if (products.length !== input.items.length) {
      throw new Error("Some products in your cart are unavailable.");
    }

    let subtotal = 0; // brutto subtotal
    const orderItemsToInsert = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const basePrice = Number(product.priceNet);

      // priceNet2 and priceNet3 represent the TOTAL netto price for 2 or 3 pieces respectively
      // Tiered pricing only applies for exactly 1, 2, or 3 pieces. For qty > 3, use base price * qty.
      let totalForItem: number; // netto
      if (item.quantity === 3) {
        totalForItem = product.priceNet3 != null ? Number(product.priceNet3) : basePrice * 3;
      } else if (item.quantity === 2) {
        totalForItem = product.priceNet2 != null ? Number(product.priceNet2) : basePrice * 2;
      } else if (item.quantity === 1) {
        totalForItem = basePrice;
      } else {
        // qty > 3: use per-unit price from tier 3 if available
        if (product.priceNet3 != null) {
          totalForItem = (Number(product.priceNet3) / 3) * item.quantity;
        } else {
          totalForItem = basePrice * item.quantity;
        }
      }

      // Compute brutto amount for this item
      const taxRate = Number(product.taxRate || 0);
      const bruttoForItem = totalForItem * (1 + taxRate / 100);

      // Effective netto per-unit price stored for records
      const unitPrice = totalForItem / item.quantity;

      subtotal += bruttoForItem;
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        taxRate: product.taxRate,
      };
    });

    const minOrder = Number(zone.minimumOrderValue || 0);
    if (subtotal < minOrder) { // subtotal is now brutto
      throw new Error(`Minimum order value is ${minOrder.toFixed(2)}€`);
    }

    const appSettings = await db.selectFrom("appSettings").select(["freeDeliveryThreshold", "deliveryFee"]).executeTakeFirst();
    const FREE_DELIVERY_THRESHOLD = appSettings?.freeDeliveryThreshold != null ? Number(appSettings.freeDeliveryThreshold) : 25;
    const globalDeliveryFee = appSettings?.deliveryFee != null ? Number(appSettings.deliveryFee) : 0;
    // subtotal is brutto; compare against threshold and add delivery fee
    const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : globalDeliveryFee;
    const total = subtotal + deliveryFee; // brutto total

    if (input.paymentMethod === "points") {
      const balance = Number(dbUser.pointsBalance || 0);
      if (balance < total) { // compare against brutto total
        throw new Error("Nicht genug Guthaben, bitte Aufladen");
      }
    }

    const orderNumber = await db.transaction().execute(async (trx) => {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
      const likeStr = `#${todayStr}-%`;

      const todayOrders = await trx
        .selectFrom("orders")
        .select("orderNumber")
        .where("orderNumber", "like", likeStr)
        .execute();

      let maxN = 0;
      for (const o of todayOrders) {
        const parts = o.orderNumber.split("-");
        const n = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(n) && n > maxN) maxN = n;
      }
      const nextN = maxN + 1;
      const genOrderNumber = `#${todayStr}-${nextN}`;

      if (input.paymentMethod === "points") {
        await trx
          .updateTable("users")
          .set({ pointsBalance: (Number(dbUser.pointsBalance || 0) - total).toString() })
          .where("id", "=", dbUser.id)
          .execute();

        await trx
          .insertInto("pointTransactions")
          .values({
            amount: (-total).toString(),
            customerId: dbUser.id,
            type: "order_payment",
            note: `Payment for order ${genOrderNumber}`,
            referenceId: genOrderNumber,
          })
          .execute();
      }

      const order = await trx
        .insertInto("orders")
        .values({
          customerId: dbUser.id,
          orderNumber: genOrderNumber,
          deliveryZoneId: zone.id,
          status: "pending",
          paymentMethod: input.paymentMethod,
          subtotal: subtotal.toString(), // brutto subtotal
          deliveryFee: deliveryFee.toString(),
          total: total.toString(), // brutto total
          pointsUsed: input.paymentMethod === "points" ? total.toString() : "0",
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
          deliveryNote: input.deliveryNote ?? null,
          preferredDeliveryDay: input.preferredDeliveryDay ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("orderItems")
        .values(
          orderItemsToInsert.map((oi) => ({
            ...oi,
            orderId: order.id,
          }))
        )
        .execute();

      return genOrderNumber;
    });

    // Send confirmation email — fire and forget; order success must not depend on email delivery
    try {
      const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

      const paymentMethodLabels: Record<string, string> = {
        apple_pay: "Apple Pay",
        credit_card: "Kreditkarte",
        gpay: "Google Pay",
        klarna: "Klarna",
        paypal: "PayPal",
        points: "Punkte",
      };

      const itemRows = orderItemsToInsert
        .map((item) => {
          const taxRate = parseFloat(String(item.taxRate ?? 0));
          const unitPriceBrutto = parseFloat(item.unitPrice) * (1 + taxRate / 100);
          const lineTotalBrutto = unitPriceBrutto * item.quantity;
          return `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620;">${item.quantity}×</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620;">${item.productName}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620; text-align: right;">${formatCurrency(unitPriceBrutto)}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620; text-align: right; font-weight: 600;">${formatCurrency(lineTotalBrutto)}</td>
            </tr>`;
        })
        .join("");

      const deliveryFeeRowHtml =
        deliveryFee > 0
          ? `<tr>
              <td colspan="3" style="padding: 8px 12px; color: #122620; text-align: right;">Liefergebühr</td>
              <td style="padding: 8px 12px; color: #122620; text-align: right;">${formatCurrency(deliveryFee)}</td>
            </tr>`
          : `<tr>
              <td colspan="3" style="padding: 8px 12px; color: #6ECFB5; text-align: right;">Liefergebühr</td>
              <td style="padding: 8px 12px; color: #6ECFB5; text-align: right; font-style: italic;">Kostenlos</td>
            </tr>`;

      const orderItemsTable = `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f4faf8;">
              <th style="padding: 10px 12px; text-align: left; color: #6ECFB5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Menge</th>
              <th style="padding: 10px 12px; text-align: left; color: #6ECFB5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Produkt</th>
              <th style="padding: 10px 12px; text-align: right; color: #6ECFB5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Einzelpreis</th>
              <th style="padding: 10px 12px; text-align: right; color: #6ECFB5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px 12px; color: #122620; text-align: right; border-top: 1px solid #e8f5f1;">Zwischensumme</td>
              <td style="padding: 8px 12px; color: #122620; text-align: right; border-top: 1px solid #e8f5f1;">${formatCurrency(subtotal)}</td>
            </tr>
            ${deliveryFeeRowHtml}
            <tr style="background-color: #f4faf8;">
              <td colspan="3" style="padding: 10px 12px; color: #122620; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #6ECFB5;">Gesamtbetrag</td>
              <td style="padding: 10px 12px; color: #122620; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #6ECFB5;">${formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>`;

      let deliveryInfoHtml = "";
      if (input.deliveryDate) {
        const dateFormatted = new Date(input.deliveryDate).toLocaleDateString("de-DE", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Lieferdatum:</strong> ${dateFormatted}</p>`;
      } else if (input.preferredDeliveryDay) {
        const dayLabels: Record<string, string> = {
          monday: "Montag",
          tuesday: "Dienstag",
          wednesday: "Mittwoch",
          thursday: "Donnerstag",
          friday: "Freitag",
          saturday: "Samstag",
          sunday: "Sonntag",
        };
        const dayLabel = dayLabels[input.preferredDeliveryDay] ?? input.preferredDeliveryDay;
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Bevorzugter Liefertag:</strong> ${dayLabel}</p>`;
      }

      if (input.deliveryNote) {
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Lieferhinweis:</strong> ${input.deliveryNote}</p>`;
      }

      const greeting = dbUser.firstName ? `Hallo ${dbUser.firstName},` : "Hallo,";
      const customerName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || dbUser.email;

      const templateVars: Record<string, string> = {
        greeting,
        orderNumber,
        orderItemsTable,
        paymentMethod: paymentMethodLabels[input.paymentMethod] ?? input.paymentMethod,
        deliveryInfo: deliveryInfoHtml,
        subtotal: formatCurrency(subtotal),
        deliveryFee: deliveryFee > 0 ? formatCurrency(deliveryFee) : "Kostenlos",
        total: formatCurrency(total),
      };

      // Load template from DB; fall back to hardcoded HTML if not found
      const emailTemplate = await db
        .selectFrom("emailTemplates")
        .selectAll()
        .where("slug", "=", "order_confirmation")
        .executeTakeFirst();

      let emailSubject: string;
      let emailHtml: string;

      if (emailTemplate) {
        emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
        emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
        console.log(`Using DB email template for order confirmation (order ${orderNumber})`);
      } else {
        emailSubject = `Bestellbestätigung ${orderNumber} – Biber Fieber`;
        emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4faf8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4faf8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(18,38,32,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #6ECFB5; padding: 28px 32px;">
              <h1 style="margin: 0; color: #122620; font-size: 24px; font-weight: 700;">🌿 Biber Fieber</h1>
              <p style="margin: 6px 0 0; color: #122620; font-size: 14px; opacity: 0.8;">Bio-Frühstück Lieferservice</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 18px; color: #122620; font-weight: 600;">${greeting}</p>
              <p style="margin: 0 0 24px; color: #122620; line-height: 1.6;">
                vielen Dank für deine Bestellung! Wir haben sie erhalten und bereiten sie liebevoll für dich vor.
              </p>

              <!-- Order Number -->
              <div style="background-color: #f4faf8; border-left: 4px solid #6ECFB5; padding: 14px 18px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #122620; font-size: 14px;">Bestellnummer</p>
                <p style="margin: 4px 0 0; color: #122620; font-size: 20px; font-weight: 700;">${orderNumber}</p>
              </div>

              <!-- Items Table -->
              <h2 style="margin: 0 0 12px; color: #122620; font-size: 16px; font-weight: 700; border-bottom: 2px solid #6ECFB5; padding-bottom: 8px;">Deine Bestellung</h2>
              ${orderItemsTable}

              <!-- Payment & Delivery Info -->
              <h2 style="margin: 0 0 12px; color: #122620; font-size: 16px; font-weight: 700; border-bottom: 2px solid #6ECFB5; padding-bottom: 8px;">Bestelldetails</h2>
              <div style="margin-bottom: 24px;">
                <p style="margin: 4px 0; color: #122620;"><strong>Zahlungsmethode:</strong> ${paymentMethodLabels[input.paymentMethod] ?? input.paymentMethod}</p>
                ${deliveryInfoHtml}
              </div>

              <!-- Closing -->
              <p style="margin: 0 0 8px; color: #122620; line-height: 1.6;">
                Wir freuen uns, dir dein Bio-Frühstück zu liefern! Bei Fragen erreichst du uns jederzeit.
              </p>
              <p style="margin: 0; color: #122620; line-height: 1.6;">
                Herzliche Grüße,<br>
                <strong style="color: #6ECFB5;">Dein Biber Fieber Team 🌿</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f4faf8; padding: 20px 32px; text-align: center; border-top: 1px solid #e8f5f1;">
              <p style="margin: 0; color: #122620; font-size: 12px; opacity: 0.6;">© Biber Fieber Bio-Frühstück Lieferplattform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
        console.log(`No DB template found for 'order_confirmation', using hardcoded fallback (order ${orderNumber})`);
      }

      await sendMailjetEmail({
        to: [{ email: dbUser.email, name: customerName }],
        subject: emailSubject,
        html: emailHtml,
      });

      console.log(`Order confirmation email sent for order ${orderNumber} to ${dbUser.email}`);
    } catch (emailError) {
      console.error(`Failed to send order confirmation email for order ${orderNumber}:`, emailError);
    }

    return new Response(superjson.stringify({ success: true, orderNumber } satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.name === "NotAuthenticatedError" ? 401 : 400 });
  }
}