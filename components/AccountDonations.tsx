import React, { useState, useMemo } from "react";
import { Heart, Info, FileText, Printer, Share } from "lucide-react";
import { useCharityOrganizations, useUpdateCharityOrganization } from "../helpers/useDonationApi";
import { useCustomerDonationReceipt } from "../helpers/useCustomerDonationReceipt";
import { generateDonationReceiptPdf, generateDonationReceiptPdfBlob } from "../helpers/generateDonationReceiptPdf";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "./Dialog";
import { Skeleton } from "./Skeleton";
import { toast } from "sonner";
import { useTranslation } from "../helpers/useTranslation";
import styles from "./AccountDonations.module.css";

// We type the profile specifically for the fields we need here
interface AccountDonationsProps {
  profile?: {
    referredByBibercode?: string | null;
    charityOrganizationId?: number | null;
  } | null;
}

export const AccountDonations = ({ profile }: AccountDonationsProps) => {
  const { t } = useTranslation();
  const { data: organizations, isLoading } = useCharityOrganizations();
  const { mutateAsync: updateOrg, isPending } = useUpdateCharityOrganization();

  // Receipt section state
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const hasCharity = !!profile?.charityOrganizationId;
  const { data: receipt, isLoading: isReceiptLoading } = useCustomerDonationReceipt(hasCharity ? selectedMonth : "");

  const formatMonthLabel = (yyyy_mm: string) => {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

  const handleChange = async (value: string) => {
    try {
      const charityOrganizationId = value === "__empty" ? null : parseInt(value, 10);
      await updateOrg({ charityOrganizationId });
      toast.success(t("donations.org_updated"));
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Ein Fehler ist aufgetreten.");
      }
    }
  };

  const handleOpenPdf = () => {
    if (receipt) {
      generateDonationReceiptPdf(receipt, formatMonthLabel(selectedMonth));
    }
    setIsDialogOpen(false);
  };

  const handleSharePdf = async () => {
    if (!receipt) return;
    try {
      const monthLabel = formatMonthLabel(selectedMonth);
      const blob = await generateDonationReceiptPdfBlob(receipt, monthLabel);
      const fileName = `Spendenquittung_${selectedMonth}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Spendenquittung ${monthLabel}`,
          text: `Hier ist die Spendenquittung für ${monthLabel}`
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

  if (profile?.referredByBibercode) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.infoBanner}>
          <Info size={20} className={styles.infoIcon} />
          <p className={styles.infoText}>
            {t("donations.bibercode_info")}
          </p>
        </div>
      </div>
    );
  }

  const selectedValue = profile?.charityOrganizationId?.toString() || "__empty";

  return (
    <div className={styles.viewContainer}>
      <div className={styles.donationCard}>
        <div className={styles.header}>
          <div className={styles.iconBox}>
            <Heart size={20} className={styles.icon} />
          </div>
          <div className={styles.headerText}>
            <h3 className={styles.title}>{t("donations.title")}</h3>
            <p className={styles.description}>
              {t("donations.description")}
            </p>
          </div>
        </div>

        <div className={styles.controlRow}>
          <label className={styles.selectLabel}>{t("donations.preferred_org")}</label>
          <div className={styles.selectWrapper}>
            <Select value={selectedValue} onValueChange={handleChange} disabled={isLoading || isPending}>
              <SelectTrigger>
                <SelectValue placeholder={t("donations.select_org")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">{t("donations.no_org")}</SelectItem>
                {organizations?.map((org) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {hasCharity && (
        <div className={styles.donationCard}>
          <div className={styles.receiptHeader}>
            <div className={styles.header}>
              <div className={styles.iconBox}>
                <FileText size={20} className={styles.icon} />
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.title}>{t("donations.monthly_receipt")}</h3>
                <p className={styles.description}>
                  {t("donations.receipt_description")}
                </p>
              </div>
            </div>

            <div className={styles.receiptControls}>
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
                disabled={isReceiptLoading || !receipt || receipt.orders.length === 0}
                onClick={() => setIsDialogOpen(true)}
              >
                <Printer size={16} /> {t("donations.print_pdf")}
              </Button>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("donations.what_to_do")}</DialogTitle>
              </DialogHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', margin: 'var(--spacing-4) 0' }}>
                <Button onClick={handleOpenPdf} variant="outline" style={{ justifyContent: 'flex-start' }}>
                  <FileText size={16} style={{ marginRight: '8px' }} /> {t("donations.open_pdf")}
                </Button>
                <Button onClick={handleSharePdf} variant="outline" style={{ justifyContent: 'flex-start' }}>
                  <Share size={16} style={{ marginRight: '8px' }} /> {t("donations.share_pdf")}
                </Button>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{t("donations.cancel")}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isReceiptLoading ? (
            <div className={styles.receiptLoading}>
              <Skeleton style={{ height: '60px', marginBottom: 'var(--spacing-4)' }} />
              <Skeleton style={{ height: '150px' }} />
            </div>
          ) : !receipt || receipt.orders.length === 0 ? (
            <p className={styles.emptyState}>{t("donations.no_orders")}</p>
          ) : (
            <>
              <div className={styles.receiptSummary}>
                <div className={styles.receiptSummaryRow}>
                  <span>{t("donations.organization")}</span>
                  <span className={styles.summaryValue}>{receipt.organization.name}</span>
                </div>
                <div className={styles.receiptSummaryRow}>
                  <span>{t("donations.net_order_volume")}</span>
                  <span className={styles.summaryValue}>{formatCurrency(receipt.totalNetSubtotal)}</span>
                </div>
                <div className={styles.receiptSummaryRow}>
                  <span>{t("donations.total_donation")}</span>
                  <span className={styles.summaryDonation}>{formatCurrency(receipt.totalDonation)}</span>
                </div>
              </div>

              <div className={styles.receiptOrders}>
                {receipt.orders.map((order, idx) => (
                  <div key={`${order.orderNumber}-${idx}`} className={styles.receiptOrder}>
                    <div className={styles.orderHeader}>
                      <span className={styles.orderDate}>{new Date(order.orderDate).toLocaleDateString('de-DE')}</span>
                      <span className={styles.orderNum}>{order.orderNumber}</span>
                    </div>
                    <div className={styles.orderAmounts}>
                      <div className={styles.amountRow}>
                        <span>{t("donations.net_order_sum")}</span>
                        <span>{formatCurrency(order.netSubtotal)}</span>
                      </div>
                      <div className={styles.amountRow}>
                        <span>{t("donations.donation_amount")}</span>
                        <span className={styles.donationText}>{formatCurrency(order.donationAmount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};