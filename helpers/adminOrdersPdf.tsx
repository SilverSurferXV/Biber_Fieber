import { getEffectiveDeliveryDay } from './getEffectiveDeliveryDay';

export const WEEKDAYS_MAP: Record<string, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

export const formatDeliveryDay = (val?: string | null) => {
  if (!val) return '-';
  const date = new Date(val);
  if (isNaN(date.getTime())) {
    return WEEKDAYS_MAP[val.toLowerCase()] || val;
  }
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const generatePdf4x6 = async (orders: any[]) => {
  // @ts-ignore
  const pdfMake = await import("pdfmake/build/pdfmake");
  // @ts-ignore
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake as any).addVirtualFileSystem(pdfFonts);

  const PAGE_WIDTH = 288;
  const PAGE_HEIGHT = 432;

  const content: any[] = [];

  orders.forEach((order, idx) => {
    const pageContent: any[] = [];

    // Customer name
    pageContent.push({
      text: order.customerName || 'Unbekannter Kunde',
      fontSize: 11,
      bold: true,
      margin: [0, 0, 0, 4],
    });

    // Address
    const addressParts = [
      order.customerStreet,
      [order.customerPostcode, order.customerCity].filter(Boolean).join(' '),
    ].filter(Boolean);
    if (addressParts.length > 0) {
      pageContent.push({
        text: addressParts.join('\n'),
        fontSize: 9,
        margin: [0, 0, 0, 4],
      });
    }

    // Phone
    if (order.customerMobile) {
      pageContent.push({
        text: `Tel: ${order.customerMobile}`,
        fontSize: 9,
        margin: [0, 0, 0, 4],
      });
    }

    // Liefertag
    pageContent.push({
      text: `Liefertag: ${formatDeliveryDay(getEffectiveDeliveryDay(order))}`,
      fontSize: 9,
      margin: [0, 0, 0, 4],
    });

    // Bemerkung
    if (order.deliveryNote) {
      pageContent.push({
        text: `Bemerkung: ${order.deliveryNote}`,
        fontSize: 9,
        italics: true,
        margin: [0, 0, 0, 6],
      });
    }

    // Items table
    const tableBody: any[] = [
      [
        { text: 'Artikel', fontSize: 9, bold: true },
        { text: 'Menge', fontSize: 9, bold: true, alignment: 'right' },
      ],
    ];

    (order.items || []).forEach((item: any) => {
      tableBody.push([
        { text: item.productName, fontSize: 9 },
        { text: String(item.quantity), fontSize: 9, alignment: 'right' },
      ]);
    });

    pageContent.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto'],
        body: tableBody,
      },
      layout: 'lightHorizontalLines',
    });

    if (idx === 0) {
      content.push(...pageContent);
    } else {
      // Add pageBreak before first element of this order
      const [first, ...rest] = pageContent;
      content.push({ ...first, pageBreak: 'before' as const });
      content.push(...rest);
    }
  });

  const docDefinition = {
    pageSize: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    pageMargins: [16, 16, 16, 16] as [number, number, number, number],
    content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
    },
  };

  pdfMake.createPdf(docDefinition).download('Bestellungen_4x6.pdf');
};

const NO_SUPPLIER_LABEL = 'Ohne Lieferant';

export const generatePdf = async (orders: any[]) => {
  // @ts-ignore
  const pdfMake = await import("pdfmake/build/pdfmake");
  // @ts-ignore
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake as any).addVirtualFileSystem(pdfFonts);

  // groups[dayKey][supplierKey][productName] = { quantity, articleNumber }
  const groups: Record<string, Record<string, Record<string, { quantity: number; articleNumber: string | null }>>> = {};

  orders.forEach((order) => {
    const dayKey = getEffectiveDeliveryDay(order) || '';
    if (!groups[dayKey]) {
      groups[dayKey] = {};
    }

    order.items?.forEach((item: any) => {
      const supplierKey: string = item.supplier || '';
      if (!groups[dayKey][supplierKey]) {
        groups[dayKey][supplierKey] = {};
      }
      if (!groups[dayKey][supplierKey][item.productName]) {
        groups[dayKey][supplierKey][item.productName] = { quantity: 0, articleNumber: item.articleNumber ?? null };
      }
      groups[dayKey][supplierKey][item.productName].quantity += item.quantity || 0;
    });
  });

  const sortedDayKeys = Object.keys(groups).sort();

  const content: any[] = [
    { text: 'Bestellübersicht – Artikelzusammenfassung', style: 'header' },
    { text: `Generiert am: ${new Date().toLocaleString('de-DE')}`, style: 'subheader' },
  ];

  sortedDayKeys.forEach((dayKey, idx) => {
    const formattedDay = dayKey ? formatDeliveryDay(dayKey) : 'Kein Liefertag';
    content.push({ text: formattedDay, style: 'groupHeader', ...(idx > 0 ? { pageBreak: 'before' as const } : {}) });

    const supplierGroups = groups[dayKey];
    // Sort supplier keys alphabetically, empty string (no supplier) goes last
    const sortedSupplierKeys = Object.keys(supplierGroups).sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (a !== '' && b === '') return -1;
      return a.localeCompare(b);
    });

    if (sortedSupplierKeys.length === 0) {
      content.push({ text: 'Keine Artikel', margin: [0, 0, 0, 10] });
      return;
    }

    sortedSupplierKeys.forEach((supplierKey) => {
      const supplierLabel = supplierKey || NO_SUPPLIER_LABEL;
      content.push({ text: supplierLabel, style: 'supplierHeader' });

      const products = supplierGroups[supplierKey];
      const sortedProductNames = Object.keys(products).sort((a, b) => a.localeCompare(b));

      const tableBody = [
        [
          { text: 'Art.-Nr.', style: 'tableHeader' },
          { text: 'Artikel', style: 'tableHeader' },
          { text: 'Menge', style: 'tableHeader', alignment: 'right' },
        ],
      ];

      sortedProductNames.forEach((productName) => {
        const { quantity, articleNumber } = products[productName];
        tableBody.push([
          { text: articleNumber ?? '-' } as any,
          productName,
          { text: quantity.toString(), alignment: 'right' } as any,
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto'],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16],
      });
    });
  });

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] as any },
      subheader: { fontSize: 12, margin: [0, 0, 0, 20] as any },
      groupHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 8] as any },
      supplierHeader: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] as any, color: '#555555' },
      tableHeader: { bold: true, fillColor: '#f2f2f2' },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };

  pdfMake.createPdf(docDefinition).download('Artikelzusammenfassung.pdf');
};