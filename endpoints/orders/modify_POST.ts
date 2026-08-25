import { schema, OutputType } from "./modify_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sendMailjetEmail } from "../../helpers/sendMailjetEmail";
import { replaceTemplateVars } from "../../helpers/replaceTemplateVars";
import { UpdateObject } from "kysely";
import { DB } from "../../helpers/schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // 1 & 2: Fetch the order, verify ownership
    const order = await db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", input.orderId)
      .executeTakeFirst();

    if (!order || order.customerId !== user.id) {
      throw new Error("Bestellung nicht gefunden oder gehört nicht zu diesem Benutzer.");
    }

    // 3 & 4: Verify status and modification flag
    if (order.status !== "pending") {
      throw new Error("Nur ausstehende (pending) Bestellungen können geändert werden.");
    }

    if (order.modified) {
      throw new Error("Diese Bestellung wurde bereits einmal geändert.");
    }

    // 5: Cutoff validation
    const appSettings = await db
      .selectFrom("appSettings")
      .select(["orderCutoffTime", "freeDeliveryThreshold", "deliveryFee"])
      .executeTakeFirst();

    const targetDateStr =
      input.deliveryDate ||
      (order.deliveryDate ? new Date(order.deliveryDate).toISOString().split("T")[0] : null);

    if (targetDateStr && targetDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [targetYear, targetMonth, targetDay] = targetDateStr
        .substring(0, 10)
        .split("-")
        .map(Number);
      const cutoffTimeString = appSettings?.orderCutoffTime || "16:00";
      const [cutoffHour, cutoffMinute] = cutoffTimeString.split(":").map(Number);

      // Construct cutoff date as local components (one day before delivery date at cutoff time)
      const cutoffDateObj = new Date(
        targetYear,
        targetMonth - 1,
        targetDay - 1,
        cutoffHour,
        cutoffMinute
      );

      // Get current time in Europe/Berlin
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(new Date());
      const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

      const nowYear = parseInt(getPart("year")!);
      const nowMonth = parseInt(getPart("month")!) - 1;
      const nowDay = parseInt(getPart("day")!);
      // handle 24:00 formatting edge cases in some environments
      const rawHour = parseInt(getPart("hour")!);
      const nowHour = rawHour === 24 ? 0 : rawHour;
      const nowMinute = parseInt(getPart("minute")!);

      const nowBerlin = new Date(nowYear, nowMonth, nowDay, nowHour, nowMinute);

      if (nowBerlin >= cutoffDateObj) {
        throw new Error("Die Änderungsfrist für diese Bestellung ist abgelaufen.");
      }
    }

    // Prepare Products and Pricing
    const productIds = input.items.map((i) => i.productId);
    const products = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "in", productIds)
      .where("active", "=", true)
      .execute();

    if (products.length !== input.items.length) {
      throw new Error("Some products in your cart are unavailable.");
    }

    let subtotal = 0;
    const orderItemsToInsert = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const basePrice = Number(product.priceNet);

      let totalForItem: number; // netto
      if (item.quantity === 3) {
        totalForItem = product.priceNet3 != null ? Number(product.priceNet3) : basePrice * 3;
      } else if (item.quantity === 2) {
        totalForItem = product.priceNet2 != null ? Number(product.priceNet2) : basePrice * 2;
      } else if (item.quantity === 1) {
        totalForItem = basePrice;
      } else {
        if (product.priceNet3 != null) {
          totalForItem = (Number(product.priceNet3) / 3) * item.quantity;
        } else {
          totalForItem = basePrice * item.quantity;
        }
      }

      const taxRate = Number(product.taxRate || 0);
      const bruttoForItem = totalForItem * (1 + taxRate / 100);
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

    const FREE_DELIVERY_THRESHOLD =
      appSettings?.freeDeliveryThreshold != null ? Number(appSettings.freeDeliveryThreshold) : 25;
    const globalDeliveryFee =
      appSettings?.deliveryFee != null ? Number(appSettings.deliveryFee) : 0;
    const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : globalDeliveryFee;
    const total = subtotal + deliveryFee;

    const oldTotal = Number(order.total || 0);
    const difference = total - oldTotal;

    // Transaction to apply the update
    await db.transaction().execute(async (trx) => {
      // Refresh user balance lock check
      const dbUser = await trx
        .selectFrom("users")
        .selectAll()
        .where("id", "=", user.id)
        .executeTakeFirstOrThrow();

      if (order.paymentMethod === "points" && difference !== 0) {
        const balance = Number(dbUser.pointsBalance || 0);
        if (difference > 0 && balance < difference) {
          throw new Error("Nicht genügend Punkte für die Preisdifferenz.");
        }

        const newBalance = balance - difference;
        await trx
          .updateTable("users")
          .set({ pointsBalance: newBalance.toString() })
          .where("id", "=", dbUser.id)
          .execute();

        await trx
          .insertInto("pointTransactions")
          .values({
            amount: (-difference).toString(), // Positive for refund, negative for deduction
            customerId: dbUser.id,
            type: "order_payment",
            note:
              difference > 0
                ? `Zusatzkosten für Bestellungsänderung ${order.orderNumber}`
                : `Rückerstattung für Bestellungsänderung ${order.orderNumber}`,
            referenceId: order.orderNumber,
          })
          .execute();
      }

      // Replace Order Items
      await trx.deleteFrom("orderItems").where("orderId", "=", order.id).execute();

      await trx
        .insertInto("orderItems")
        .values(
          orderItemsToInsert.map((oi) => ({
            ...oi,
            orderId: order.id,
          }))
        )
        .execute();

      // Update Order
      const orderUpdate: UpdateObject<DB, "orders"> = {
        subtotal: subtotal.toString(),
        deliveryFee: deliveryFee.toString(),
        total: total.toString(),
        pointsUsed: order.paymentMethod === "points" ? total.toString() : order.pointsUsed,
        modified: true,
      };

      if (input.deliveryDate !== undefined) {
        orderUpdate.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
      }
      if (input.preferredDeliveryDay !== undefined) {
        orderUpdate.preferredDeliveryDay = input.preferredDeliveryDay;
      }
      if (input.deliveryNote !== undefined) {
        orderUpdate.deliveryNote = input.deliveryNote;
      }

      await trx.updateTable("orders").set(orderUpdate).where("id", "=", order.id).execute();
    });

    // 10: Email Sending
    try {
      const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

      const paymentMethodLabels: Record<string, string> = {
        amazon_pay: "Amazon Pay",
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
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620;">${
                item.quantity
              }×</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620;">${
                item.productName
              }</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620; text-align: right;">${formatCurrency(
                unitPriceBrutto
              )}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e8f5f1; color: #122620; text-align: right; font-weight: 600;">${formatCurrency(
                lineTotalBrutto
              )}</td>
            </tr>`;
        })
        .join("");

      const deliveryFeeRowHtml =
        deliveryFee > 0
          ? `<tr>
              <td colspan="3" style="padding: 8px 12px; color: #122620; text-align: right;">Liefergebühr</td>
              <td style="padding: 8px 12px; color: #122620; text-align: right;">${formatCurrency(
                deliveryFee
              )}</td>
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
              <td style="padding: 8px 12px; color: #122620; text-align: right; border-top: 1px solid #e8f5f1;">${formatCurrency(
                subtotal
              )}</td>
            </tr>
            ${deliveryFeeRowHtml}
            <tr style="background-color: #f4faf8;">
              <td colspan="3" style="padding: 10px 12px; color: #122620; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #6ECFB5;">Gesamtbetrag</td>
              <td style="padding: 10px 12px; color: #122620; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #6ECFB5;">${formatCurrency(
                total
              )}</td>
            </tr>
          </tfoot>
        </table>`;

      let deliveryInfoHtml = "";
      const effectiveDeliveryDate =
        input.deliveryDate !== undefined ? input.deliveryDate : order.deliveryDate;
      const effectiveDeliveryDay =
        input.preferredDeliveryDay !== undefined
          ? input.preferredDeliveryDay
          : order.preferredDeliveryDay;
      const effectiveDeliveryNote =
        input.deliveryNote !== undefined ? input.deliveryNote : order.deliveryNote;

      if (effectiveDeliveryDate) {
        const dateFormatted = new Date(effectiveDeliveryDate).toLocaleDateString("de-DE", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Lieferdatum:</strong> ${dateFormatted}</p>`;
      } else if (effectiveDeliveryDay) {
        const dayLabels: Record<string, string> = {
          monday: "Montag",
          tuesday: "Dienstag",
          wednesday: "Mittwoch",
          thursday: "Donnerstag",
          friday: "Freitag",
          saturday: "Samstag",
          sunday: "Sonntag",
        };
        const dayLabel = dayLabels[effectiveDeliveryDay] ?? effectiveDeliveryDay;
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Bevorzugter Liefertag:</strong> ${dayLabel}</p>`;
      }

      if (effectiveDeliveryNote) {
        deliveryInfoHtml += `<p style="margin: 4px 0; color: #122620;"><strong>Lieferhinweis:</strong> ${effectiveDeliveryNote}</p>`;
      }

      const greeting = user.firstName ? `Hallo ${user.firstName},` : "Hallo,";
      const customerName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const paymentMethodStr = order.paymentMethod
        ? paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod
        : "Unbekannt";

      const templateVars: Record<string, string> = {
        greeting,
        orderNumber: order.orderNumber,
        orderItemsTable,
        paymentMethod: paymentMethodStr,
        deliveryInfo: deliveryInfoHtml,
        subtotal: formatCurrency(subtotal),
        deliveryFee: deliveryFee > 0 ? formatCurrency(deliveryFee) : "Kostenlos",
        total: formatCurrency(total),
      };

      const emailTemplate = await db
        .selectFrom("emailTemplates")
        .selectAll()
        .where("slug", "=", "order_modification")
        .executeTakeFirst();

      let emailSubject: string;
      let emailHtml: string;

      if (emailTemplate) {
        emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
        emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
        console.log(`Using DB email template for order modification (order ${order.orderNumber})`);
      } else {
        emailSubject = `Bestelländerung ${order.orderNumber} – Biber Fieber`;
        emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4faf8; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4faf8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(18,38,32,0.08);">
          <tr>
            <td style="background-color: #6ECFB5; padding: 28px 32px;">
              <h1 style="margin: 0; color: #122620; font-size: 24px; font-weight: 700;">🌿 Biber Fieber</h1>
              <p style="margin: 6px 0 0; color: #122620; font-size: 14px; opacity: 0.8;">Bio-Frühstück Lieferservice</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 18px; color: #122620; font-weight: 600;">${greeting}</p>
              <p style="margin: 0 0 24px; color: #122620; line-height: 1.6;">
                Deine Bestellung wurde erfolgreich geändert. Hier sind die aktualisierten Details:
              </p>
              <div style="background-color: #f4faf8; border-left: 4px solid #6ECFB5; padding: 14px 18px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #122620; font-size: 14px;">Bestellnummer</p>
                <p style="margin: 4px 0 0; color: #122620; font-size: 20px; font-weight: 700;">${
                  order.orderNumber
                }</p>
              </div>
              <h2 style="margin: 0 0 12px; color: #122620; font-size: 16px; font-weight: 700; border-bottom: 2px solid #6ECFB5; padding-bottom: 8px;">Deine Bestellung</h2>
              ${orderItemsTable}
              <h2 style="margin: 0 0 12px; color: #122620; font-size: 16px; font-weight: 700; border-bottom: 2px solid #6ECFB5; padding-bottom: 8px;">Bestelldetails</h2>
              <div style="margin-bottom: 24px;">
                <p style="margin: 4px 0; color: #122620;"><strong>Zahlungsmethode:</strong> ${paymentMethodStr}</p>
                ${deliveryInfoHtml}
              </div>
              <p style="margin: 0; color: #122620; line-height: 1.6;">
                Herzliche Grüße,<br>
                <strong style="color: #6ECFB5;">Dein Biber Fieber Team 🌿</strong>
              </p>
            </td>
          </tr>
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
        console.log(`No DB template found for 'order_modification', using hardcoded fallback (order ${order.orderNumber})`);
      }

      await sendMailjetEmail({
        to: [{ email: user.email, name: customerName }],
        subject: emailSubject,
        html: emailHtml,
      });

    } catch (emailError) {
      console.error(`Failed to send order modification email for order ${order.orderNumber}:`, emailError);
    }

    return new Response(
      superjson.stringify({ success: true, orderNumber: order.orderNumber } satisfies OutputType)
    );
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), {
      status: error.name === "NotAuthenticatedError" ? 401 : 400,
    });
  }
}