// @ts-ignore
import PdfPrinter from "pdfmake";
import { GutschriftData } from "./generateGutschriftPdf";

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatDateWithWeekday = (dateString: string): string => {
  const d = new Date(dateString);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

export async function generateGutschriftPdfBuffer(data: GutschriftData): Promise<string> {
  const fonts = {
    Roboto: {
      normal: 'fonts/Roboto-Regular.ttf',
      bold: 'fonts/Roboto-Medium.ttf',
      italics: 'fonts/Roboto-Italic.ttf',
      bolditalics: 'fonts/Roboto-MediumItalic.ttf'
    }
  };

  const {
    driverName,
    driverEmail,
    invoiceCompanyName,
    invoiceStreet,
    invoiceHouseNumber,
    invoicePostcode,
    invoiceCity,
    invoiceTaxId,
    invoiceTaxNumber,
    vatEligible,
    blockStart,
    blockEnd,
    stopCompensation,
    packagingCompensation,
    dailyEarnings,
    packagingDays,
  } = data;

  const creationDate = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const gutschriftNumber = `GS-${blockStart.getFullYear()}-${String(
    blockStart.getMonth() + 1
  ).padStart(2, "0")}-${String(blockStart.getDate()).padStart(2, "0")}`;
  const blockPeriod = `${formatDate(blockStart)} – ${formatDate(blockEnd)}`;

  // Recipient info
  const recipientLines = [];
  if (invoiceCompanyName) recipientLines.push({ text: invoiceCompanyName, bold: true });
  else recipientLines.push({ text: driverName, bold: true });

  if (invoiceCompanyName && driverName) recipientLines.push({ text: `z.Hd. ${driverName}` });
  
  const streetLine = [invoiceStreet, invoiceHouseNumber].filter(Boolean).join(" ");
  if (streetLine) recipientLines.push({ text: streetLine });
  
  const cityLine = [invoicePostcode, invoiceCity].filter(Boolean).join(" ");
  if (cityLine) recipientLines.push({ text: cityLine });

  if (driverEmail) recipientLines.push({ text: `Email: ${driverEmail}`, margin: [0, 5, 0, 0] });
  if (invoiceTaxId) recipientLines.push({ text: `UST ID: ${invoiceTaxId}` });
  if (invoiceTaxNumber) recipientLines.push({ text: `Steuernummer: ${invoiceTaxNumber}` });

  // Prepare Stopvergütung Table
  let totalStopEarnings = 0;
  const stopRows: any[][] = [
    [
      { text: "Datum", style: "tableHeader" },
      { text: "Anzahl Stops", style: "tableHeader", alignment: "center" },
      { text: "Betrag", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (dailyEarnings.length > 0) {
    dailyEarnings.forEach((day) => {
      totalStopEarnings += day.earnings;
      stopRows.push([
        { text: formatDateWithWeekday(day.date) },
        { text: day.stopsCount.toString(), alignment: "center" },
        { text: formatCurrency(day.earnings), alignment: "right" },
      ]);
    });
  } else {
    stopRows.push([
      { text: "Keine Stops in diesem Zeitraum", colSpan: 3, italics: true, color: "#666" },
      {},
      {},
    ]);
  }

  // Subtotal Stopvergütung
  stopRows.push([
    { text: "Zwischensumme Stopvergütung", bold: true, colSpan: 2 },
    {},
    { text: formatCurrency(totalStopEarnings), alignment: "right", bold: true },
  ]);

  // Prepare Verpackungsvergütung Table
  let totalPackagingEarnings = 0;
  const packagingRows: any[][] = [
    [
      { text: "Datum", style: "tableHeader" },
      { text: "Verpackung", style: "tableHeader", alignment: "center" },
      { text: "Betrag", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (packagingDays.length > 0) {
    packagingDays.forEach((day) => {
      totalPackagingEarnings += packagingCompensation;
      packagingRows.push([
        { text: formatDateWithWeekday(day.date) },
        { text: "✓", alignment: "center" },
        { text: formatCurrency(packagingCompensation), alignment: "right" },
      ]);
    });
  } else {
    packagingRows.push([
      { text: "Keine Verpackungstage in diesem Zeitraum", colSpan: 3, italics: true, color: "#666" },
      {},
      {},
    ]);
  }

  // Subtotal Verpackungsvergütung
  packagingRows.push([
    { text: "Zwischensumme Verpackungsvergütung", bold: true, colSpan: 2 },
    {},
    { text: formatCurrency(totalPackagingEarnings), alignment: "right", bold: true },
  ]);

  const grandTotal = totalStopEarnings + totalPackagingEarnings;
  
  const summaryBody: any[][] = [
    [
      { text: "Summe Stopvergütung:", margin: [0, 2, 0, 2] },
      { text: formatCurrency(totalStopEarnings), alignment: "right", margin: [0, 2, 0, 2] }
    ],
    [
      { text: "Summe Verpackungsvergütung:", margin: [0, 2, 0, 2] },
      { text: formatCurrency(totalPackagingEarnings), alignment: "right", margin: [0, 2, 0, 2] }
    ]
  ];

  if (vatEligible) {
    const vatAmount = grandTotal * 0.07;
    const finalTotal = grandTotal + vatAmount;
    
    summaryBody.push(
      [
        { text: "Gesamtbetrag (Netto):", margin: [0, 10, 0, 2] },
        { text: formatCurrency(grandTotal), alignment: "right", margin: [0, 10, 0, 2] }
      ],
      [
        { text: "Umsatzsteuer (7%):", margin: [0, 2, 0, 2] },
        { text: formatCurrency(vatAmount), alignment: "right", margin: [0, 2, 0, 2] }
      ],
      [
        { text: "Endbetrag inkl. USt.:", bold: true, fontSize: 14, margin: [0, 10, 0, 0] },
        { text: formatCurrency(finalTotal), bold: true, fontSize: 14, alignment: "right", margin: [0, 10, 0, 0] }
      ]
    );
  } else {
    summaryBody.push([
      { text: "Gesamtbetrag:", bold: true, fontSize: 14, margin: [0, 10, 0, 0] },
      { text: formatCurrency(grandTotal), bold: true, fontSize: 14, alignment: "right", margin: [0, 10, 0, 0] }
    ]);
  }

  const content: any[] = [
    // Sender Info (top left)
    {
      stack: [
        { text: "Biber Fieber UG (haftungsbeschränkt)", bold: true, fontSize: 12 },
        { text: "Am Hartholz 3", margin: [0, 2, 0, 0] },
        { text: "82239 Alling", margin: [0, 2, 0, 0] },
        { text: "", margin: [0, 5, 0, 0] },
        { text: "UST ID: DE 366 184 903" },
        { text: "STEUER NR: 117 / 122 / 40433" },
      ],
      margin: [0, 0, 0, 20],
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e0e0e0" }],
      margin: [0, 0, 0, 15],
    },
    // Header
    {
      text: "GUTSCHRIFT RECHNUNG",
      style: "mainHeader",
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e0e0e0" }],
      margin: [0, 0, 0, 20],
    },
    
    // Meta Info & Address
    {
      columns: [
        {
          width: "*",
          stack: recipientLines,
        },
        {
          width: "auto",
          stack: [
            { text: `Gutschriftsnummer:`, bold: true, margin: [0, 0, 0, 2] },
            { text: gutschriftNumber, margin: [0, 0, 0, 10] },
            { text: `Leistungszeitraum:`, bold: true, margin: [0, 0, 0, 2] },
            { text: blockPeriod },
          ],
          alignment: "right",
        }
      ],
      margin: [0, 0, 0, 30],
    },

    // Stops Section
    { text: `Stopvergütung (${formatCurrency(stopCompensation)} / Stop)`, style: "sectionHeader" },
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto"],
        body: stopRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 5, 0, 20],
    },

    // Packaging Section
    { text: `Verpackungsvergütung (${formatCurrency(packagingCompensation)} / Tag)`, style: "sectionHeader" },
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto"],
        body: packagingRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 5, 0, 30],
    },

    // Summary
    {
      columns: [
        { width: "*", text: "" },
        {
          width: 250,
          table: {
            widths: ["*", "auto"],
            body: summaryBody
          },
          layout: "noBorders"
        }
      ]
    },

    // Footer
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e0e0e0" }],
      margin: [0, 40, 0, 10],
    },
    { text: `Erstellt am: ${creationDate}`, fontSize: 9, color: "#666" },
    {
      text: "Erstellt von: Biber Fieber Lieferplattform",
      fontSize: 9,
      color: "#666",
    }
  ];

  const docDefinition = {
    pageSize: "A4" as const,
    content,
    styles: {
      companyHeader: {
        fontSize: 14,
        color: "#666",
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      mainHeader: {
        fontSize: 22,
        bold: true,
        color: "#2e2e2e",
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: "#6ECFB5", // Using the mint/teal brand accent
        margin: [0, 10, 0, 5] as [number, number, number, number],
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "#2e2e2e",
      },
    },
    defaultStyle: {
      fontSize: 10,
      color: "#2e2e2e",
    },
  };

  const printer = new PdfPrinter(fonts);
  // Using 'any' as PdfPrinter.createPdfKitDocument typedef might conflict slightly with client-side definitions
  const doc = printer.createPdfKitDocument(docDefinition as any);
  const chunks: Buffer[] = [];
  
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  
  return new Promise<string>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);
    doc.end();
  });
}