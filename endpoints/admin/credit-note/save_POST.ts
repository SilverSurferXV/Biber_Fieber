import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";
import { db } from '../../../helpers/db';
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { sql } from "kysely";
import { computeDriverStopEarnings } from '../../../helpers/computeDriverStopEarnings';
import { sendMailjetEmail } from '../../../helpers/sendMailjetEmail';
import { generateGutschriftPdfBuffer } from '../../../helpers/generateGutschriftPdfBuffer';
import { replaceTemplateVars } from '../../../helpers/replaceTemplateVars';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const data = schema.parse(json);

    // Default expiration is 48 hours from now
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Determine detailData: use provided value or auto-construct from DB
    let resolvedDetailData = data.detailData;

    if (resolvedDetailData == null) {
      console.log(`[credit-note/save] detailData not provided by client for driver ${data.driverId} — auto-generating from DB.`);

      // 1. Look up driver profile
      const driverProfile = await db
        .selectFrom("users")
        .select([
          "firstName",
          "lastName",
          "email",
          "invoiceCompanyName",
          "invoiceStreet",
          "invoiceHouseNumber",
          "invoicePostcode",
          "invoiceCity",
          "invoiceTaxId",
          "invoiceTaxNumber",
          "vatEligible",
        ])
        .where("id", "=", data.driverId)
        .executeTakeFirst();

      if (!driverProfile) {
        return new Response(
          superjson.stringify({ error: "Driver not found." }),
          { status: 404 }
        );
      }

      const driverName = [driverProfile.firstName, driverProfile.lastName]
        .filter(Boolean)
        .join(" ") || driverProfile.email;

      // 2. Compute daily stop earnings including company car deductions
      const stopEarningsResult = await computeDriverStopEarnings({
        driverId: data.driverId,
        stopCompensation: data.stopCompensation,
        from: data.blockStart,
        to: data.blockEnd,
        orderDirection: "asc",
      });

      const dailyEarnings = stopEarningsResult.dailyEarnings.map(day => ({
        date: day.date,
        stopsCount: day.stopsCount,
        companyCarStops: day.companyCarStops,
        grossEarnings: day.grossEarnings,
        carDeduction: day.carDeduction,
        earnings: day.earnings,
      }));

      // 3. Query packaging days for the block period
      const packagingDaysRows = await db
        .selectFrom("orders")
        .select([
          sql<string>`COALESCE(delivery_date::date, created_at::date)::text`.as("date"),
        ])
        .where("packerDriverId", "=", data.driverId)
        .where("status", "=", "delivered")
        .where(sql`COALESCE(delivery_date::date, created_at::date) >= ${data.blockStart}::date`)
        .where(sql`COALESCE(delivery_date::date, created_at::date) <= ${data.blockEnd}::date`)
        .groupBy(sql`COALESCE(delivery_date::date, created_at::date)`)
        .orderBy(sql`COALESCE(delivery_date::date, created_at::date)`, "asc")
        .execute();

      const packagingDays = packagingDaysRows.map((row) => ({ date: row.date }));

      // 4. Construct detailData
      resolvedDetailData = {
        driverName,
        driverEmail: driverProfile.email,
        invoiceCompanyName: driverProfile.invoiceCompanyName ?? null,
        invoiceStreet: driverProfile.invoiceStreet ?? null,
        invoiceHouseNumber: driverProfile.invoiceHouseNumber ?? null,
        invoicePostcode: driverProfile.invoicePostcode ?? null,
        invoiceCity: driverProfile.invoiceCity ?? null,
        invoiceTaxId: driverProfile.invoiceTaxId ?? null,
        invoiceTaxNumber: driverProfile.invoiceTaxNumber ?? null,
        vatEligible: driverProfile.vatEligible,
        dailyEarnings,
        packagingDays,
        totalCarDeduction: stopEarningsResult.totalCarDeduction,
      };

      // If the client didn't pass a top-level totalCarDeduction, update it from the auto-generated result
      if (!data.totalCarDeduction) {
        data.totalCarDeduction = stopEarningsResult.totalCarDeduction;
      }

      console.log(
        `[credit-note/save] Auto-generated detailData for driver ${data.driverId}: ${dailyEarnings.length} delivery days, ${packagingDays.length} packaging days.`
      );
    } else {
      console.log(`[credit-note/save] Using client-provided detailData for driver ${data.driverId}.`);
    }

    // Look for an existing credit note for this driver and gutschriftNumber
    const existing = await db
      .selectFrom("driverCreditNotes")
      .select("id")
      .where("driverId", "=", data.driverId)
      .where("gutschriftNumber", "=", data.gutschriftNumber)
      .executeTakeFirst();

    let creditNoteId: number;

    if (existing) {
      // Update
      const updated = await db
        .updateTable("driverCreditNotes")
        .set({
          blockStart: data.blockStart,
          blockEnd: data.blockEnd,
          stopCompensation: data.stopCompensation,
          packagingCompensation: data.packagingCompensation,
          totalStopEarnings: data.totalStopEarnings,
          totalPackagingEarnings: data.totalPackagingEarnings,
          totalAmount: data.totalAmount,
          totalCarDeduction: data.totalCarDeduction,
          vatAmount: data.vatAmount,
          detailData: JSON.stringify(resolvedDetailData),
          status: "pending", // Reset status to pending on update
          expiresAt: expiresAt,
        })
        .where("id", "=", existing.id)
        .returning(["id"])
        .executeTakeFirstOrThrow();

      creditNoteId = updated.id;
    } else {
      // Insert
      const inserted = await db
        .insertInto("driverCreditNotes")
        .values({
          driverId: data.driverId,
          gutschriftNumber: data.gutschriftNumber,
          blockStart: data.blockStart,
          blockEnd: data.blockEnd,
          stopCompensation: data.stopCompensation,
          packagingCompensation: data.packagingCompensation,
          totalStopEarnings: data.totalStopEarnings,
          totalPackagingEarnings: data.totalPackagingEarnings,
          totalAmount: data.totalAmount,
          totalCarDeduction: data.totalCarDeduction,
          vatAmount: data.vatAmount,
          detailData: JSON.stringify(resolvedDetailData),
          status: "pending",
          expiresAt: expiresAt,
          createdByAdminId: user.id,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      creditNoteId = inserted.id;
    }

    // Send credit note PDF to driver via email (fire-and-forget)
    try {
      // Get driver email info
      const driverInfo = await db
        .selectFrom("users")
        .select(["email", "firstName", "lastName"])
        .where("id", "=", data.driverId)
        .executeTakeFirst();

      if (driverInfo?.email) {
        // Prepare data for PDF generation
        const detail = resolvedDetailData!;
        const pdfBase64 = await generateGutschriftPdfBuffer({
          driverName: detail.driverName,
          driverEmail: detail.driverEmail,
          invoiceCompanyName: detail.invoiceCompanyName ?? null,
          invoiceStreet: detail.invoiceStreet ?? null,
          invoiceHouseNumber: detail.invoiceHouseNumber ?? null,
          invoicePostcode: detail.invoicePostcode ?? null,
          invoiceCity: detail.invoiceCity ?? null,
          invoiceTaxId: detail.invoiceTaxId ?? null,
          invoiceTaxNumber: detail.invoiceTaxNumber ?? null,
          vatEligible: detail.vatEligible,
          blockStart: new Date(data.blockStart),
          blockEnd: new Date(data.blockEnd),
          stopCompensation: data.stopCompensation,
          packagingCompensation: data.packagingCompensation,
          dailyEarnings: detail.dailyEarnings,
          packagingDays: detail.packagingDays,
          totalCarDeduction: detail.totalCarDeduction ?? data.totalCarDeduction,
        });

        const driverFullName =
          [driverInfo.firstName, driverInfo.lastName].filter(Boolean).join(" ") ||
          driverInfo.email;
        const fileName = `Gutschrift-${data.gutschriftNumber}.pdf`;

        // Load email template from DB or use fallback
        const emailTemplate = await db
          .selectFrom("emailTemplates")
          .selectAll()
          .where("slug", "=", "credit_note_driver")
          .executeTakeFirst();

        const templateVars = {
          driverName: driverFullName,
          gutschriftNumber: data.gutschriftNumber,
          blockStart: formatDate(new Date(data.blockStart)),
          blockEnd: formatDate(new Date(data.blockEnd)),
          totalAmount: formatCurrency(data.totalAmount),
        };

        let emailSubject: string;
        let emailHtml: string;

        if (emailTemplate) {
          emailSubject = replaceTemplateVars(emailTemplate.subject, templateVars);
          emailHtml = replaceTemplateVars(emailTemplate.htmlBody, templateVars);
        } else {
          // German fallback
          emailSubject = `Neue Gutschrift ${data.gutschriftNumber} – Biber Fieber`;
          emailHtml = `<div style="font-family: Arial, sans-serif; color: #122620;">
            <h2>Hallo ${driverFullName},</h2>
            <p>eine neue Gutschrift wurde für dich erstellt.</p>
            <p><strong>Gutschriftsnummer:</strong> ${data.gutschriftNumber}</p>
            <p><strong>Zeitraum:</strong> ${templateVars.blockStart} – ${templateVars.blockEnd}</p>
            <p><strong>Gesamtbetrag:</strong> ${templateVars.totalAmount}</p>
            <p>Die Gutschrift findest du als PDF im Anhang.</p>
            <br>
            <p>Herzliche Grüße,<br><strong style="color: #6ECFB5;">Dein Biber Fieber Team</strong></p>
          </div>`;
        }

        await sendMailjetEmail({
          to: [{ email: driverInfo.email, name: driverFullName }],
          subject: emailSubject,
          html: emailHtml,
          attachments: [
            {
              filename: fileName,
              contentType: "application/pdf",
              base64Content: pdfBase64,
            },
          ],
        });

        console.log(
          `Credit note email with PDF sent to driver ${data.driverId} (${driverInfo.email})`
        );
      }
    } catch (emailError) {
      console.error("Failed to send credit note email:", emailError);
    }

    return new Response(
      superjson.stringify({
        id: creditNoteId,
        gutschriftNumber: data.gutschriftNumber,
        status: "pending",
        expiresAt,
      } satisfies OutputType)
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}