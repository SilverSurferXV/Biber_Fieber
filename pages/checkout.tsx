import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart, getEffectivePrice, getEffectiveBruttoPrice } from '../helpers/useCart';
import { useProfile, useCheckout, useOrders } from '../helpers/useCustomerApi';
import { useDeliveryZoneCheck, useSettings } from '../helpers/useShopApi';
import { useModifyOrder } from '../helpers/useModifyOrder';
import { useTranslation } from '../helpers/useTranslation';
import { Button } from '../components/Button';
import { Calendar } from '../components/Calendar';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { toast } from 'sonner';
import { Trash } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { Progress } from '../components/Progress';
import { Checkbox } from '../components/Checkbox';
import { getSonderbereichFiles } from '../endpoints/sonderbereich/list_GET.schema';
import { getDeliveryZoneCheck } from '../endpoints/delivery-zones/check_GET.schema';
import { getDeliveryZonesList } from '../endpoints/delivery-zones/list_GET.schema';
import { isAdult } from '../helpers/isAdult';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/Dialog';
import styles from './checkout.module.css';

interface InactiveZoneInfo {
  postcode: string;
  userCount: number;
  activationThreshold: number | null;
  hasZone: boolean;
  cityName?: string | null;
}

export default function Checkout() {
  const { items, getTotal, removeFromCart, updateQuantity, clearCart } = useCart();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: zone, isLoading: zoneLoading } = useDeliveryZoneCheck(profile?.postcode || '');
  const { data: settings } = useSettings();
  const { mutateAsync: doCheckout, isPending } = useCheckout();
  const { mutateAsync: doModify, isPending: isModifying } = useModifyOrder();
  const { data: orders } = useOrders();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modifyOrderId = searchParams.get('modify') ? parseInt(searchParams.get('modify')!) : null;

  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [preferredDeliveryDay, setPreferredDeliveryDay] = useState<string>('');
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [datenschutzAccepted, setDatenschutzAccepted] = useState(false);
  const [inactiveZoneInfo, setInactiveZoneInfo] = useState<InactiveZoneInfo | null>(null);
  const [checkingZone, setCheckingZone] = useState(false);

  const WEEKDAYS: Record<string, string> = {
    monday: t("weekdays.monday"),
    tuesday: t("weekdays.tuesday"),
    wednesday: t("weekdays.wednesday"),
    thursday: t("weekdays.thursday"),
    friday: t("weekdays.friday"),
    saturday: t("weekdays.saturday"),
    sunday: t("weekdays.sunday")
  };

  const availableDays = settings?.openingHours
    ? Object.keys(WEEKDAYS).filter(day => {
        const dayData = (settings.openingHours as any)[day];
        return dayData && dayData.active === true;
      })
    : Object.keys(WEEKDAYS);

  const now = new Date();
  const berlinStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin", hour12: false });
  const berlinDate = new Date(berlinStr);
  const cutoffStr = settings?.orderCutoffTime || "16:00";
  const [cutoffHour, cutoffMin] = cutoffStr.split(':').map(Number);
  const cutoff = new Date(berlinDate);
  cutoff.setHours(cutoffHour, cutoffMin, 0, 0);
  const isPastCutoff = berlinDate.getTime() > cutoff.getTime();

  const WEEKDAY_INDEX: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const startDate = new Date(baseDate.getTime() + (isPastCutoff ? 2 : 1) * 86400000);

  const getDayInfo = (day: string) => {
    const targetDay = WEEKDAY_INDEX[day.toLowerCase()];
    if (targetDay === undefined) return { label: WEEKDAYS[day] || day, dateStr: day };
    const date = new Date(startDate);
    const currentDay = date.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    // If we're at or past the target day in the week, ensure we get the next occurrence
    // actually, targetDay - currentDay + 7 % 7 is correct for the immediate next occurrence or today
    date.setDate(date.getDate() + daysToAdd);
    const dateStr = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    const isoDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { label: `${WEEKDAYS[day]}, ${dateStr}`, dateStr: isoDateStr };
  };

  const dayOptions = availableDays.map(day => {
    const info = getDayInfo(day);
    return { key: day, label: info.label, value: info.dateStr };
  }).sort((a, b) => a.value.localeCompare(b.value));

  const FREE_DELIVERY_THRESHOLD = settings?.freeDeliveryThreshold ?? 25;

  const subtotal = getTotal();
  const effectiveDeliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : (zone?.deliveryFee || 0);
  const total = subtotal + effectiveDeliveryFee;
  const totalTax = items.reduce((acc, item) => {
    const brutto = getEffectiveBruttoPrice(item);
    const net = getEffectivePrice(item);
    return acc + (brutto - net);
  }, 0);
  const minMet = zone ? subtotal >= zone.minimumOrderValue : false;

  const amountUntilFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeDeliveryProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  const isMissingDob = Boolean(!profileLoading && !profile?.dateOfBirth);
  const isUnderage = Boolean(!profileLoading && profile?.dateOfBirth && !isAdult(profile.dateOfBirth));

  const volumeDiscountSavings = items.reduce((acc, item) => {
    const baseBrutto = item.price * (1 + (item.taxRate || 0) / 100);
    const baseBruttoTotal = baseBrutto * item.quantity;
    const effPriceBrutto = getEffectiveBruttoPrice(item);
    if ((item.priceNet2 != null || item.priceNet3 != null) && effPriceBrutto < baseBruttoTotal) {
      return acc + (baseBruttoTotal - effPriceBrutto);
    }
    return acc;
  }, 0);

  const freeDeliverySavings = (subtotal >= FREE_DELIVERY_THRESHOLD && zone && Number(zone.deliveryFee) > 0) 
    ? Number(zone.deliveryFee) 
    : 0;

  const totalSavings = volumeDiscountSavings + freeDeliverySavings;

  const isDisabledDate = (date: Date) => {
    const t = new Date();
    t.setHours(0,0,0,0);
    // Require at least the day after tomorrow since cutoff is passed
    const minDate = new Date(t.getTime() + 86400000); 
    if (date <= minDate) return true;
    // Disable days when the shop is closed
    const dayIndex = date.getDay(); // 0=Sun,1=Mon,...6=Sat
    const indexToDay: Record<number, string> = { 0:'sunday',1:'monday',2:'tuesday',3:'wednesday',4:'thursday',5:'friday',6:'saturday' };
    const dayName = indexToDay[dayIndex];
    return !availableDays.includes(dayName);
  };

  const maxAvailableDate = new Date();
  maxAvailableDate.setDate(maxAvailableDate.getDate() + 60);

  const isAvailableDate = (date: Date) => {
    return !isDisabledDate(date) && date <= maxAvailableDate;
  };

  const handleAGBClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const files = await getSonderbereichFiles();
      const agbFile = files.find(f => f.title.toLowerCase().includes('agb'));
      if (agbFile && agbFile.pdfUrl) {
        window.open(agbFile.pdfUrl, '_blank');
      } else {
        toast.error(t('AGB Dokument nicht gefunden.'));
      }
    } catch (error: any) {
      toast.error(t('Fehler beim Laden der AGBs.'));
    }
  };

  const handleDatenschutzClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const files = await getSonderbereichFiles();
      const datenschutzFile = files.find(f => f.title.toLowerCase().includes('datenschutz'));
      if (datenschutzFile && datenschutzFile.pdfUrl) {
        window.open(datenschutzFile.pdfUrl, '_blank');
      } else {
        toast.error(t('Datenschutzerklärung nicht gefunden.'));
      }
    } catch (error: any) {
      toast.error(t('Fehler beim Laden der Datenschutzerklärung.'));
    }
  };

  const handleModifyCheckout = async () => {
    if (!modifyOrderId) return;
    setCheckingZone(true);
    try {
      const res = await doModify({
        orderId: modifyOrderId,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      });
      toast.success(t("checkout.order_updated"));
      clearCart();
      navigate('/account?tab=bestellungen');
    } catch (e: any) {
      toast.error(e.message || t("checkout.order_update_error"));
    } finally {
      setCheckingZone(false);
    }
  };

  const handleCheckout = async () => {
    if (modifyOrderId) return handleModifyCheckout();
    if (!profile?.postcode) return toast.error(t("Bitte geben Sie eine Postleitzahl in Ihrem Profil an."));
    if (!zone) return toast.error(t("Keine gültige Lieferzone für Ihre PLZ gefunden."));
    if (isMissingDob) return toast.error(t("age.dob_required"));
    if (isUnderage) return toast.error(t("age.min_18"));
    if (!minMet) return toast.error(t("checkout.min_order_not_reached", { amount: Number(zone.minimumOrderValue).toFixed(2) }));
    if (!isPastCutoff && !preferredDeliveryDay) return toast.error(t("Bitte wählen Sie einen Liefertag aus."));
    if (isPastCutoff && !deliveryDate) return toast.error(t("Bitte wählen Sie ein Lieferdatum für die Vorbestellung aus."));
    
    setCheckingZone(true);
    try {
      // Check delivery zone threshold BEFORE checkout
      const zoneCheck = await getDeliveryZoneCheck({ postcode: profile.postcode, checkThreshold: true });
      if (zoneCheck === null) {
        // Zone is not active — fetch details and show dialog
        let zoneInfo: InactiveZoneInfo = {
          postcode: profile.postcode,
          userCount: 0,
          activationThreshold: null,
          hasZone: false,
        };

        try {
          const zones = await getDeliveryZonesList();
          const regexMatch = zones.find((z) => {
            const regexStr = "^" + z.postcodePattern.replace(/\*/g, ".*") + "$";
            try {
              return new RegExp(regexStr).test(profile.postcode || "");
            } catch {
              return false;
            }
          });

          zoneInfo = {
            postcode: profile.postcode,
            userCount: regexMatch?.userCount ?? 0,
            activationThreshold: regexMatch?.activationThreshold ?? null,
            hasZone: regexMatch !== undefined,
            cityName: regexMatch?.cityName ?? null,
          };
        } catch (zoneListError) {
          console.error("Failed to fetch zone list:", zoneListError);
        }

        setInactiveZoneInfo(zoneInfo);
        setCheckingZone(false);
        return; // Block checkout
      }
    } catch (zoneError) {
      console.error("Zone check failed before checkout:", zoneError);
      // Proceed if check fails
    }
    setCheckingZone(false);

    try {
      const res = await doCheckout({
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod: "points" as const,
        deliveryDate: deliveryDate ? `${deliveryDate.getFullYear()}-${String(deliveryDate.getMonth() + 1).padStart(2, '0')}-${String(deliveryDate.getDate()).padStart(2, '0')}` : undefined,
        preferredDeliveryDay: preferredDeliveryDay || undefined,
        deliveryNote: deliveryNote || undefined
      });
      toast.success(t("checkout.success", { number: res.orderNumber }));
      clearCart();
      navigate('/account?tab=bestellungen');
    } catch (e: any) {
      toast.error(e.message || t("Fehler bei der Bestellung"));
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <h2>{t("checkout.empty_cart")}</h2>
        <Button onClick={() => navigate('/shop')} className={styles.shopBtn}>{t("checkout.back_to_shop")}</Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Dialog
        open={inactiveZoneInfo !== null}
        onOpenChange={(open) => {
          if (!open) setInactiveZoneInfo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("checkout.zone_inactive")}</DialogTitle>
            <DialogDescription>
              {inactiveZoneInfo && (
                <>
                  {inactiveZoneInfo.hasZone ? (
                    <>
                      {t("Dein Liefergebiet")} {inactiveZoneInfo.cityName ? `${inactiveZoneInfo.cityName} ` : ""}(PLZ {inactiveZoneInfo.postcode}) {t("ist noch nicht aktiv.")}
                      <br />
                      {t("Bisher haben sich")} {inactiveZoneInfo.userCount} {t("Nutzer angemeldet.")}
                      <br />
                      {inactiveZoneInfo.activationThreshold !== null ? (
                        <>
                          {t("Es fehlen noch")}{" "}
                          {Math.max(
                            0,
                            inactiveZoneInfo.activationThreshold -
                              inactiveZoneInfo.userCount
                          )}{" "}
                          {t("Nutzer bis zur Aktivierung.")}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {t("Dein Liefergebiet (PLZ")} {inactiveZoneInfo.postcode}) {t("wird derzeit noch nicht beliefert. Wir arbeiten daran, unser Liefergebiet auszubauen.")}
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInactiveZoneInfo(null)}>
              {t("checkout.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={styles.headerRow}>
        <h1 className={styles.title}>{modifyOrderId ? t("checkout.modify_title") : t("checkout.title")}</h1>
        <Button variant="outline" size="lg" onClick={() => navigate('/shop')}>
          {t("checkout.back_to_shop")}
        </Button>
      </div>
      
      <div className={styles.grid}>
        <div className={styles.itemsSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t("checkout.articles")}</h2>
            <div className={styles.itemList}>
              {items.map(item => {
                const effPriceBrutto = getEffectiveBruttoPrice(item);
                const baseBrutto = item.price * (1 + (item.taxRate || 0) / 100);
                const baseBruttoTotal = baseBrutto * item.quantity;
                const isDiscounted = effPriceBrutto < baseBruttoTotal;

                return (
                <div key={item.productId} className={styles.cartItem}>
                  <div className={styles.itemImageWrapper}>
                    {item.photoUrl ? <img src={item.photoUrl} alt={item.name} /> : <div className={styles.noImage} />}
                  </div>
                  <div className={styles.itemInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.itemPrice}>
                      {isDiscounted && (item.priceNet2 != null || item.priceNet3 != null) && (
                        <span className={styles.originalPrice}>{baseBruttoTotal.toFixed(2)} €</span>
                      )}
                      <span>{effPriceBrutto.toFixed(2)} €</span>
                    </p>
                  </div>
                  <div className={styles.itemControls}>
                    <Button variant="outline" size="icon-sm" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>-</Button>
                    <span className={styles.qty}>{item.quantity}</span>
                    <Button variant="outline" size="icon-sm" onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={false}>+</Button>
                    <Button variant="ghost" size="icon-sm" className={styles.removeBtn} onClick={() => removeFromCart(item.productId)}>
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>

        <div className={styles.summarySection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t("checkout.delivery_payment")}</h2>
            
            {!modifyOrderId && !isPastCutoff && (
              <div className={styles.dayBox}>
                <h3>{t("checkout.delivery_day")}</h3>
                <Select value={preferredDeliveryDay} onValueChange={setPreferredDeliveryDay}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("checkout.please_select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {dayOptions.map(opt => (
                        <SelectItem key={opt.key} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!modifyOrderId && (
            <div className={styles.addressBox}>
              <h3>{t("checkout.delivery_address")}</h3>
              {profileLoading ? <Skeleton style={{ height: '60px' }} /> : (
                <div className={styles.address}>
                  <p>{profile?.firstName} {profile?.lastName}</p>
                  <p>{profile?.streetAddress}</p>
                  <p>{profile?.postcode} {profile?.city}</p>
                </div>
              )}
            </div>
            )}

            {!modifyOrderId && (
            <div className={styles.noteBox}>
              <h3>{t("checkout.note")}</h3>
              <Textarea 
                placeholder={t("checkout.note_placeholder")} 
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
              />
            </div>
            )}

            {!modifyOrderId && (
            <div className={styles.paymentBox}>
              <h3>{t("checkout.payment_method")}</h3>
              <div className={styles.staticPayment}>
                {t("nav.guthaben")} {profile?.pointsBalance || 0} {t("checkout.points_value")}
              </div>
            </div>
            )}

            {!modifyOrderId && isPastCutoff && (
              <div className={styles.dateBox}>
                <h3>{t("checkout.preorder_date")}</h3>
                <p className={styles.dateDesc}>{t("checkout.cutoff_reached")}</p>
                <div className={styles.calendarWrapper}>
                  <Calendar 
                    mode="single" 
                    selected={deliveryDate} 
                    onSelect={(d: Date | undefined) => setDeliveryDate(d)} 
                    disabled={isDisabledDate}
                    modifiers={{ available: isAvailableDate }}
                    modifiersClassNames={{ available: styles.availableDay }}
                  />
                </div>
              </div>
            )}

            <div className={styles.totalsBox}>
              <div className={styles.totalRow}>
                <span>{t("shop.subtotal")}</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className={styles.totalRow}>
                <span>{t("shop.delivery_fee")}</span>
                {zoneLoading ? <Skeleton style={{ width: '40px' }} /> : (
                  effectiveDeliveryFee === 0 && zone ? (
                    <span className={styles.freeDeliveryValue}>
                      <span className={styles.originalFee}>{Number(zone.deliveryFee).toFixed(2)} €</span>
                      {t("shop.free")}
                    </span>
                  ) : (
                    <span>{zone ? `${Number(zone.deliveryFee).toFixed(2)} €` : 'N/A'}</span>
                  )
                )}
              </div>
              <div className={styles.totalRow}>
                <span>{t("shop.incl_tax")}</span>
                <span>{totalTax.toFixed(2)} €</span>
              </div>
              
              {totalSavings > 0 && (
                <div className={styles.savingsBox}>
                  <div className={styles.savingsHeader}>
                    <span>{t("checkout.you_save")}</span>
                    <span>{totalSavings.toFixed(2)} €</span>
                  </div>
                  {volumeDiscountSavings > 0 && (
                    <div className={styles.savingsRow}>
                      <span>{t("checkout.volume_discount")}</span>
                      <span>{volumeDiscountSavings.toFixed(2)} €</span>
                    </div>
                  )}
                  {freeDeliverySavings > 0 && (
                    <div className={styles.savingsRow}>
                      <span>{t("checkout.free_delivery_label")}</span>
                      <span>{freeDeliverySavings.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
              )}

              <div className={`${styles.totalRow} ${styles.finalTotal}`}>
                <span>{t("shop.total")}</span>
                <span>{total.toFixed(2)} €</span>
              </div>
              <div className={styles.freeDeliveryBanner}>
                {subtotal >= FREE_DELIVERY_THRESHOLD ? (
                  <span className={styles.freeDeliverySuccess}>✓ {t("shop.free_delivery_msg")}</span>
                ) : (
                  <div className={styles.freeDeliveryProgress}>
                    <span className={styles.freeDeliveryHint}>
                      {t("shop.free_delivery_left", { amount: amountUntilFree.toFixed(2).replace('.', ',') })}
                    </span>
                    <Progress value={freeDeliveryProgress} className={styles.freeDeliveryBar} />
                  </div>
                )}
              </div>
            </div>

            {isMissingDob && (
              <div className={styles.minWarning}>
                {t("age.dob_required")} <Link to="/account?tab=profil" style={{ textDecoration: 'underline', color: 'inherit' }}>Zum Profil</Link>
              </div>
            )}
            
            {isUnderage && (
              <div className={styles.minWarning}>
                {t("age.min_18")}
              </div>
            )}

            {zone && !minMet && (
              <div className={styles.minWarning}>
                {t("checkout.min_order_not_reached", { amount: Number(zone.minimumOrderValue).toFixed(2) })}
              </div>
            )}

            {!modifyOrderId && (
              <>
                <div className={styles.agbBox}>
                  <Checkbox 
                    id="agb" 
                    checked={agbAccepted} 
                    onChange={(e) => setAgbAccepted(e.target.checked)} 
                  />
                  <label htmlFor="agb">
                    {t("checkout.agb_1")} <span className={styles.agbLink} onClick={handleAGBClick}>AGB's</span> {t("checkout.agb_2")}
                  </label>
                </div>

                <div className={styles.agbBox}>
                  <Checkbox 
                    id="datenschutz" 
                    checked={datenschutzAccepted} 
                    onChange={(e) => setDatenschutzAccepted(e.target.checked)} 
                  />
                  <label htmlFor="datenschutz">
                    {t("checkout.privacy_1")} <span className={styles.agbLink} onClick={handleDatenschutzClick}>{t("checkout.privacy_terms")}</span> {t("checkout.privacy_2")}
                  </label>
                </div>
              </>
            )}

            <Button 
              className={styles.checkoutBtn} 
              size="lg" 
              onClick={handleCheckout}
              disabled={Boolean(modifyOrderId 
                ? (isPending || isModifying || checkingZone || zoneLoading || !zone || !minMet)
                : (isPending || checkingZone || zoneLoading || !zone || !minMet || !agbAccepted || !datenschutzAccepted || (!isPastCutoff && !preferredDeliveryDay) || (isPastCutoff && !deliveryDate) || isMissingDob || isUnderage))}
            >
              {isPending || isModifying || checkingZone ? t("checkout.processing") : (modifyOrderId ? t("checkout.update_order") : t("checkout.order"))}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}