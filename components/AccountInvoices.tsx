import React, { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { Button } from './Button';
import { useInvoice } from '../helpers/useCustomerApi';
import { generateInvoicePdf, generateInvoicePdfBlob } from '../helpers/generateInvoicePdf';
import { useTranslation } from '../helpers/useTranslation';
import { Skeleton } from './Skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './Dialog';
import { Printer, Share, FileText } from 'lucide-react';
import styles from './AccountInvoices.module.css';

export const AccountInvoices = () => {
  const { t, lang } = useTranslation();
  const months = useMemo(() => {
    const res = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      res.push(`${year}-${month}`);
      d.setMonth(d.getMonth() - 1);
    }
    return res;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(months[0]);
  const { data: invoice, isLoading } = useInvoice(selectedMonth);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const formatMonthLabel = (yyyy_mm: string) => {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  };

  const handleOpenPdf = () => {
    if (invoice) {
      generateInvoicePdf(invoice, formatMonthLabel(selectedMonth));
    }
    setIsDialogOpen(false);
  };

  const handleSharePdf = async () => {
    if (!invoice) return;
    try {
      const monthLabel = formatMonthLabel(selectedMonth);
      const blob = await generateInvoicePdfBlob(invoice, monthLabel);
      const fileName = `Rechnung_${selectedMonth}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Rechnung ${monthLabel}`,
          text: `Hier ist die Rechnung für ${monthLabel}`
        });
      } else {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Error sharing PDF:", e);
    } finally {
      setIsDialogOpen(false);
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.invoiceHeader}>
        <h3>{t("invoices.title")}</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className={styles.monthSelect}><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            disabled={isLoading || !invoice || invoice.days.length === 0}
            onClick={() => setIsDialogOpen(true)}
          >
            <Printer size={16} /> {t("invoices.print")}
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invoices.what_to_do")}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', margin: 'var(--spacing-4) 0' }}>
            <Button onClick={handleOpenPdf} variant="outline" style={{ justifyContent: 'flex-start' }}>
              <FileText size={16} style={{ marginRight: '8px' }} /> {t("invoices.open_pdf")}
            </Button>
            <Button onClick={handleSharePdf} variant="outline" style={{ justifyContent: 'flex-start' }}>
              <Share size={16} style={{ marginRight: '8px' }} /> {t("invoices.share_pdf")}
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t("profile.cancel")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isLoading && invoice && invoice.days.length > 0 && (
        <div className={styles.invoiceSummary}>
          <div className={styles.invoiceSummaryRow}>
            <span>{t("invoices.month_total")}:</span>
            <span className={styles.invoiceTotal}>{(invoice.total || 0).toFixed(2)} €</span>
          </div>
          <div className={styles.invoiceSummaryRow}>
            <span>{t("invoices.bonus_points")}:</span>
            <span className={styles.invoicePoints}>{(invoice.totalTopupBonusPoints || 0).toFixed(2)}</span>
          </div>
          <div className={styles.invoiceSummaryRow}>
            <span>{t("invoices.bibercode_points")}:</span>
            <span className={styles.invoicePoints}>{(invoice.totalBibercodePointsEarned || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={styles.invoiceLoading}>
          <Skeleton style={{ height: '40px', marginBottom: 'var(--spacing-2)' }} />
          <Skeleton style={{ height: '100px', marginBottom: 'var(--spacing-4)' }} />
          <Skeleton style={{ height: '100px' }} />
        </div>
      ) : !invoice || invoice.days.length === 0 ? (
        <p className={styles.emptyState}>{t("invoices.empty")}</p>
      ) : (
        <div className={styles.invoiceContent}>
          <div className={styles.invoiceDays}>
            {invoice.days.map((dayGroup: any) => (
              <div key={dayGroup.date} className={styles.invoiceDayGroup}>
                <h4 className={styles.invoiceDayTitle}>
                  {new Date(dayGroup.date).toLocaleDateString(lang, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h4>
                <div className={styles.invoiceOrders}>
                  {dayGroup.orders.map((order: any) => (
                    <div key={order.id} className={styles.invoiceOrder}>
                      <div className={styles.invoiceOrderHeader}>
                        <span className={styles.orderNum}>{order.orderNumber}</span>
                        <span className={styles.orderTotal}>{t("orders.total")}: {(order.total || 0).toFixed(2)} €</span>
                      </div>
                      <div className={styles.invoiceItems}>
                        {order.items.map((item: any) => (
                          <div key={item.id} className={styles.invoiceItem}>
                            <span>{item.quantity}x {item.productName}</span>
                            <span>{(item.quantity * item.unitPrice).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};