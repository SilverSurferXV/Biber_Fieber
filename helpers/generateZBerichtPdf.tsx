export interface ZBerichtData {
  date: Date;
  dateStr: string;
  brutto: number;
  netto: number;
  orderCount: number;
  uniqueCustomerCount: number;
  wareneinsatz: number;
  db1: number;
  taxes: Record<string, { netto: number; tax: number }>;
  paymentMethods: Record<string, number>;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
};

export const generateZBerichtPdf = async (data: ZBerichtData) => {
  // @ts-ignore
  const pdfMake = await import("pdfmake/build/pdfmake");
  // @ts-ignore
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake as any).addVirtualFileSystem(pdfFonts);

  const {
    date,
    dateStr,
    brutto,
    netto,
    orderCount,
    uniqueCustomerCount,
    wareneinsatz,
    db1,
    taxes,
    paymentMethods,
  } = data;

  const formattedDate = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  const creationDate = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

    const db1Percent = netto > 0 ? (db1 / netto) * 100 : 0;
  const wareneinsatzPercent = netto > 0 ? (wareneinsatz / netto) * 100 : 0;
  const avgOrderValue = orderCount > 0 ? brutto / orderCount : 0;

  // Prepare taxes table data
  let totalTaxNet = 0;
  let totalTaxAmount = 0;
  let totalTaxGross = 0;
  const taxRows: any[][] = [
    [
      { text: "Steuersatz", style: "tableHeader" },
      { text: "Netto", style: "tableHeader", alignment: "right" },
      { text: "Steuerbetrag", style: "tableHeader", alignment: "right" },
      { text: "Brutto", style: "tableHeader", alignment: "right" },
      { text: "Umsatzanteil", style: "tableHeader", alignment: "right" },
    ],
  ];

  const sortedTaxes = Object.entries(taxes).sort(
    ([a], [b]) => parseFloat(b) - parseFloat(a)
  );

  sortedTaxes.forEach(([rate, amounts]) => {
    const gross = amounts.netto + amounts.tax;
    totalTaxNet += amounts.netto;
    totalTaxAmount += amounts.tax;
    totalTaxGross += gross;

    const share = brutto > 0 ? (gross / brutto) * 100 : 0;

    taxRows.push([
      { text: `${rate}%` },
      { text: formatCurrency(amounts.netto), alignment: "right" },
      { text: formatCurrency(amounts.tax), alignment: "right" },
      { text: formatCurrency(gross), alignment: "right" },
      { text: `${share.toFixed(2).replace(".", ",")}%`, alignment: "right" },
    ]);
  });

  // Total tax row
  taxRows.push([
    { text: "Gesamt", bold: true },
    { text: formatCurrency(totalTaxNet), alignment: "right", bold: true },
    { text: formatCurrency(totalTaxAmount), alignment: "right", bold: true },
    { text: formatCurrency(totalTaxGross), alignment: "right", bold: true },
    { text: "100,00%", alignment: "right", bold: true },
  ]);

  const content: any[] = [
    // Header
    {
      text: "Biber Fieber — Bio-Frühstück Lieferservice",
      style: "companyHeader",
    },
    {
      text: "Z-Bericht / Tagesabschluss",
      style: "mainHeader",
    },
    {
      columns: [
        { text: `Datum: ${formattedDate}` },
        { text: `Belegnummer: Z-${dateStr}`, alignment: "right" },
      ],
      margin: [0, 0, 0, 10],
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      margin: [0, 0, 0, 20],
    },

    // Revenue Section
    { text: "Umsatz", style: "sectionHeader" },
    {
      columns: [
        { text: "Umsatz Brutto:", width: 150 },
        { text: formatCurrency(brutto), bold: true },
      ],
      margin: [0, 5, 0, 2],
    },
    {
      columns: [
        { text: "Umsatz Netto:", width: 150 },
        { text: formatCurrency(netto) },
      ],
      margin: [0, 2, 0, 20],
    },

    // Taxes
    { text: "Steueraufschlüsselung", style: "sectionHeader" },
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto", "auto", "auto"],
        body: taxRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 5, 0, 20],
    },

    // Costs & Margin
    { text: "Kosten & Deckungsbeitrag", style: "sectionHeader" },
    {
      columns: [
        { text: "Wareneinsatz:", width: 150 },
        { text: formatCurrency(wareneinsatz) },
      ],
      margin: [0, 5, 0, 2],
    },
    {
      columns: [
        { text: "Wareneinsatz in %:", width: 150 },
        { text: `${wareneinsatzPercent.toFixed(2).replace(".", ",")}%` },
      ],
      margin: [0, 2, 0, 2],
    },
    {
      columns: [
        { text: "DB1 (Deckungsbeitrag):", width: 150 },
        { text: formatCurrency(db1), bold: true },
      ],
      margin: [0, 2, 0, 2],
    },
    {
      columns: [
        { text: "DB1 in % vom Netto:", width: 150 },
        { text: `${db1Percent.toFixed(2).replace(".", ",")}%` },
      ],
      margin: [0, 2, 0, 20],
    },

    // Order stats
    { text: "Bestellstatistiken", style: "sectionHeader" },
    {
      columns: [
        { text: "Anzahl Bestellungen:", width: 150 },
        { text: orderCount.toString() },
      ],
      margin: [0, 5, 0, 2],
    },
    {
      columns: [
        { text: "Anzahl Kunden:", width: 150 },
        { text: uniqueCustomerCount.toString() },
      ],
      margin: [0, 2, 0, 2],
    },
    {
      columns: [
        { text: "Ø Bestellwert (Brutto):", width: 150 },
        { text: formatCurrency(avgOrderValue) },
      ],
      margin: [0, 2, 0, 20],
    },
  ];

  // Payment Methods
  const paymentEntries = Object.entries(paymentMethods);
  if (paymentEntries.length > 0) {
    const paymentRows: any[][] = [
      [
        { text: "Zahlungsart", style: "tableHeader" },
        { text: "Betrag", style: "tableHeader", alignment: "right" },
      ],
    ];

    let paymentTotal = 0;
    paymentEntries.forEach(([method, amount]) => {
      paymentTotal += amount;
      paymentRows.push([
        { text: method },
        { text: formatCurrency(amount), alignment: "right" },
      ]);
    });

    paymentRows.push([
      { text: "Gesamt", bold: true },
      { text: formatCurrency(paymentTotal), alignment: "right", bold: true },
    ]);

    content.push(
      { text: "Zahlungsarten", style: "sectionHeader" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto"],
          body: paymentRows,
        },
        layout: "lightHorizontalLines",
        margin: [0, 5, 0, 20],
      }
    );
  }

  // Footer
  content.push(
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
      margin: [0, 20, 0, 10],
    },
    { text: `Erstellt am: ${creationDate}`, fontSize: 9, color: "#666" },
    {
      text: "Erstellt von: Biber Fieber Lieferplattform",
      fontSize: 9,
      color: "#666",
    }
  );

  const docDefinition = {
    pageSize: "A4" as const,
    content,
    styles: {
      companyHeader: {
        fontSize: 16,
        bold: true,
        color: "#2e2e2e",
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      mainHeader: {
        fontSize: 20,
        bold: true,
        color: "#2e2e2e",
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: "#6ECFB5",
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

  pdfMake.createPdf(docDefinition).open();
};