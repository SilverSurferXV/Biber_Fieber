import { OutputType } from "../endpoints/customer/donation-receipt_GET.schema";

// @ts-ignore
import * as pdfMake from "pdfmake/build/pdfmake";
// @ts-ignore
import * as pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfmake with virtual file system for default fonts
(pdfMake as any).addVirtualFileSystem(pdfFonts);

/**
 * Format a number as German EUR currency (e.g., 1.234,56 €)
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
};

const buildDocDefinition = (
  receiptData: OutputType,
  monthLabel: string
) => {
  const content: any[] = [
    {
      text: `Spendenquittung — ${monthLabel}`,
      style: "header",
      margin: [0, 0, 0, 30],
    },
  ];

  // Top Section: Org & Customer details
  content.push({
    columns: [
      {
        width: "*",
        text: [
          { text: "Spendenempfänger:\n", style: "subheader" },
          `${receiptData.organization.name}\n`,
          receiptData.organization.streetAddress ? `${receiptData.organization.streetAddress}\n` : "",
          `${receiptData.organization.postcode || ""} ${receiptData.organization.city || ""}`.trim() + "\n",
          receiptData.organization.contactPerson ? `Kontakt: ${receiptData.organization.contactPerson}\n` : "",
          receiptData.organization.registerNumber ? `Registernummer: ${receiptData.organization.registerNumber}\n` : "",
        ],
      },
      {
        width: "*",
        text: [
          { text: "Spender:\n", style: "subheader" },
          `${receiptData.customerName}\n`,
          receiptData.customerAddress || "Keine Adresse hinterlegt",
        ],
      },
    ],
    margin: [0, 0, 0, 30],
  });

  content.push({
    text: "Details der geförderten Bestellungen",
    style: "subheader",
    margin: [0, 0, 0, 10],
  });

  // Order Table
  const tableBody: any[][] = [
    [
      { text: "Datum", style: "tableHeader" },
      { text: "Bestellnummer", style: "tableHeader" },
      { text: "Netto Bestellsumme", style: "tableHeader", alignment: "right" },
      { text: "Spendenbetrag (5%)", style: "tableHeader", alignment: "right" },
    ],
  ];

  receiptData.orders.forEach((order) => {
    const dateStr = order.orderDate 
      ? new Date(order.orderDate).toLocaleDateString("de-DE") 
      : "Unbekannt";

    tableBody.push([
      { text: dateStr },
      { text: order.orderNumber },
      { text: formatCurrency(order.netSubtotal), alignment: "right" },
      { text: formatCurrency(order.donationAmount), alignment: "right" },
    ]);
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["auto", "*", "auto", "auto"],
      body: tableBody,
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 20],
  });

  // Summary
  content.push({
    columns: [
      { text: "Gesamt Netto-Bestellvolumen:", width: "*" },
      { text: formatCurrency(receiptData.totalNetSubtotal), alignment: "right", width: "auto" },
    ],
    margin: [0, 5, 0, 5],
  });

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }],
    margin: [0, 5, 0, 5],
  });

  content.push({
    columns: [
      { text: "Gesamter Spendenbetrag:", bold: true, fontSize: 14, width: "*" },
      {
        text: formatCurrency(receiptData.totalDonation),
        alignment: "right",
        bold: true,
        fontSize: 14,
        width: "auto",
        color: "#2b8a3e", // Slightly green accent for the donation
      },
    ],
    margin: [0, 5, 0, 30],
  });

  // Footer Note
  content.push({
    text: "Der Spendenbetrag entspricht 5% des Netto-Bestellvolumens der oben gelisteten Bestellungen. Wir bedanken uns herzlich für Ihre Unterstützung!",
    style: "footerNote",
  });

  return {
    content,
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: "#2e2e2e",
      },
      subheader: {
        fontSize: 12,
        bold: true,
        color: "#4a4a4a",
        marginBottom: 5,
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "#2e2e2e",
      },
      footerNote: {
        fontSize: 9,
        color: "#6b7280",
        italics: true,
        alignment: "center",
      },
    },
    defaultStyle: {
      fontSize: 10,
      color: "#2e2e2e",
    },
  };
};

/**
 * Generates a donation receipt PDF based on the customer's monthly data and opens it in a new tab.
 * 
 * @param receiptData The data returned from the customer/donation-receipt_GET endpoint.
 * @param monthLabel Formatted month label (e.g., "Mai 2026").
 */
export const generateDonationReceiptPdf = (
  receiptData: OutputType,
  monthLabel: string
) => {
  const docDefinition = buildDocDefinition(receiptData, monthLabel);
  pdfMake.createPdf(docDefinition).open();
};

/**
 * Generates a donation receipt PDF and returns it as a Blob.
 * 
 * @param receiptData The data returned from the customer/donation-receipt_GET endpoint.
 * @param monthLabel Formatted month label (e.g., "Mai 2026").
 */
export const generateDonationReceiptPdfBlob = (
  receiptData: OutputType,
  monthLabel: string
): Promise<Blob> => {
  return new Promise((resolve) => {
    const docDefinition = buildDocDefinition(receiptData, monthLabel);
    pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
      resolve(blob);
    });
  });
};