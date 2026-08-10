import { OutputType } from "../endpoints/customer/invoice_GET.schema";

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
  invoiceData: OutputType,
  monthLabel: string
) => {
  let monthTotalTax = 0;

  const content: any[] = [];

  // Customer info block
  const customer = invoiceData.customer;
  const customerFullName = customer.firstName && customer.lastName
    ? `${customer.firstName} ${customer.lastName}`
    : customer.displayName;

  const customerLines: string[] = [
    `Kundennummer: ${customer.id}`,
    customerFullName,
  ];
  if (customer.companyName) customerLines.push(customer.companyName);
  if (customer.streetAddress) customerLines.push(customer.streetAddress);
  if (customer.postcode || customer.city) {
    customerLines.push(`${customer.postcode || ""} ${customer.city || ""}`.trim());
  }
  customerLines.push(customer.email);

  content.push({
    text: customerLines.join("\n"),
    style: "customerInfo",
    margin: [0, 0, 0, 20],
  });

  content.push({
    text: `Monatsrechnung — ${monthLabel}`,
    style: "header",
    margin: [0, 0, 0, 20],
  });

  invoiceData.days.forEach((dayGroup) => {
    // Format date like "Montag, 15. Mai 2026"
    const dateStr = new Date(dayGroup.date).toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    content.push({
      text: dateStr,
      style: "subheader",
      margin: [0, 15, 0, 10],
    });

    dayGroup.orders.forEach((order) => {
      content.push({
        text: `Bestellung: ${order.orderNumber}`,
        style: "orderHeader",
        margin: [0, 10, 0, 5],
      });

      const tableBody: any[][] = [
        [
          { text: "Menge", style: "tableHeader" },
          { text: "Artikel", style: "tableHeader" },
          { text: "Netto", style: "tableHeader", alignment: "right" },
          { text: "MwSt", style: "tableHeader", alignment: "right" },
          { text: "MwSt (€)", style: "tableHeader", alignment: "right" },
          { text: "Brutto", style: "tableHeader", alignment: "right" },
        ],
      ];

      order.items.forEach((item) => {
        const unitPrice = item.unitPrice || 0;
        const qty = item.quantity || 1;
        const taxRate = item.taxRate || 0;

        // Biber Fieber DB uses net prices. Calculate tax and gross from net.
        const netLine = unitPrice * qty;
        const taxLine = netLine * (taxRate / 100);
        const grossLine = netLine + taxLine;

        monthTotalTax += taxLine;

        tableBody.push([
          { text: `${qty}x` },
          { text: item.productName || "Unbekannter Artikel" },
          { text: formatCurrency(unitPrice), alignment: "right" },
          { text: `${taxRate.toLocaleString("de-DE")}%`, alignment: "right" },
          { text: formatCurrency(taxLine), alignment: "right" },
          { text: formatCurrency(grossLine), alignment: "right" },
        ]);
      });

      // Add delivery fee row if applicable
      if (order.deliveryFee && order.deliveryFee > 0) {
        tableBody.push([
          { text: "" },
          { text: "Liefergebühr" },
          { text: "-", alignment: "right" },
          { text: "-", alignment: "right" },
          { text: "-", alignment: "right" },
          { text: formatCurrency(order.deliveryFee), alignment: "right" },
        ]);
      }

      content.push({
        table: {
          headerRows: 1,
          widths: ["auto", "*", "auto", "auto", "auto", "auto"],
          body: tableBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      });

      content.push({
        text: `Bestellsumme: ${formatCurrency(order.total || 0)}`,
        style: "orderTotal",
        alignment: "right",
        margin: [0, 0, 0, 20],
      });
    });
  });

  // Monthly summary section
  content.push({
    text: "Zusammenfassung",
    style: "header",
    margin: [0, 30, 0, 10],
  });

  content.push({
    columns: [
      { text: "Gesamte MwSt:", width: "*" },
      { text: formatCurrency(monthTotalTax), alignment: "right", width: "auto" },
    ],
    margin: [0, 5, 0, 5],
  });

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }],
    margin: [0, 5, 0, 5],
  });

  content.push({
    columns: [
      { text: "Monatssumme Brutto:", bold: true, fontSize: 14, width: "*" },
      {
        text: formatCurrency(invoiceData.total),
        alignment: "right",
        bold: true,
        fontSize: 14,
        width: "auto",
      },
    ],
    margin: [0, 5, 0, 5],
  });

  return {
    content,
    styles: {
      header: {
        fontSize: 18,
        bold: true,
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: "#2e2e2e",
      },
      orderHeader: {
        fontSize: 12,
        bold: true,
        color: "#4a4a4a",
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "#2e2e2e",
      },
      orderTotal: {
        fontSize: 12,
        bold: true,
      },
      customerInfo: {
        fontSize: 9,
        color: "#4a4a4a",
        lineHeight: 1.4,
      },
    },
    defaultStyle: {
      fontSize: 10,
      color: "#2e2e2e",
    },
  };
};

/**
 * Generates an invoice PDF based on the customer's monthly data and opens it in a new tab.
 * 
 * @param invoiceData The data returned from the customer/invoice_GET endpoint.
 * @param monthLabel Formatted month label (e.g., "Mai 2026").
 */
export const generateInvoicePdf = (
  invoiceData: OutputType,
  monthLabel: string
) => {
  const docDefinition = buildDocDefinition(invoiceData, monthLabel);
  pdfMake.createPdf(docDefinition).open();
};

/**
 * Generates an invoice PDF and returns it as a Blob.
 * 
 * @param invoiceData The data returned from the customer/invoice_GET endpoint.
 * @param monthLabel Formatted month label (e.g., "Mai 2026").
 */
export const generateInvoicePdfBlob = (
  invoiceData: OutputType,
  monthLabel: string
): Promise<Blob> => {
  return new Promise((resolve) => {
    const docDefinition = buildDocDefinition(invoiceData, monthLabel);
    pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
      resolve(blob);
    });
  });
};