import React, { useState, useMemo, useEffect } from 'react';
import { Button } from './Button';
import { useOrders } from '../helpers/useCustomerApi';
import { getSonderbereichFiles } from '../endpoints/sonderbereich/list_GET.schema';
import { useCancelOrder } from '../helpers/useCancelOrder';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../helpers/useCart';
import { getProductsList } from '../endpoints/products/list_GET.schema';
import { useNavigate } from 'react-router-dom';
import { Badge } from './Badge';
import { useSettings } from '../helpers/useShopApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import { useTranslation } from '../helpers/useTranslation';
import styles from './AccountOrders.module.css';

export const AccountOrders = () => {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useOrders();
  const { mutateAsync: cancelOrder } = useCancelOrder();
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const { clearCart, addToCart } = useCart();
  const navigate = useNavigate();
  const [reorderLoadingId, setReorderLoadingId] = useState<number | null>(null);
  const [modifyLoadingId, setModifyLoadingId] = useState<number | null>(null);
  const { data: settings } = useSettings();

  const [currentTime, setCurrentTime] = useState(new Date());

  const canModifyOrder = (order: NonNullable<typeof orders>[number]) => {
    if (order.status !== 'pending') return false;
    if (order.modified) return false;

    let deliveryVal = order.deliveryDate || order.preferredDeliveryDay;
    if (!deliveryVal) return true;

    try {
      const deliveryDate = new Date(deliveryVal as string | number | Date);
      if (isNaN(deliveryDate.getTime())) return true;

      const targetDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(deliveryDate);

      const cutoffStr = settings?.orderCutoffTime || "16:00";
      const [cutoffHour, cutoffMin] = cutoffStr.split(':').map(Number);
      const [targetYear, targetMonth, targetDay] = targetDateStr.split("-").map(Number);
      
      const cutoffObj = new Date(targetYear, targetMonth - 1, targetDay - 1, cutoffHour, cutoffMin);
      
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

      const parts = formatter.formatToParts(currentTime);
      const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

      const nowYear = parseInt(getPart("year")!);
      const nowMonth = parseInt(getPart("month")!) - 1;
      const nowDay = parseInt(getPart("day")!);
      const rawHour = parseInt(getPart("hour")!);
      const nowHour = rawHour === 24 ? 0 : rawHour;
      const nowMinute = parseInt(getPart("minute")!);

      const nowBerlin = new Date(nowYear, nowMonth, nowDay, nowHour, nowMinute);

      return nowBerlin < cutoffObj;
    } catch {
      return true;
    }
  };

  const handleModifyOrder = async (order: NonNullable<typeof orders>[number]) => {
    try {
      setModifyLoadingId(order.id);
      const products = await getProductsList({});
      clearCart();

      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          addToCart({
            productId: product.id,
            name: product.name,
            price: product.priceNet,
            quantity: item.quantity,
            photoUrl: product.photoUrl,
            taxRate: product.taxRate,
            priceNet2: product.priceNet2,
            priceNet3: product.priceNet3,
          });
        } else {
          addToCart({
            productId: item.productId || Date.now(),
            name: item.productName,
            price: Number(item.unitPrice),
            quantity: item.quantity,
            photoUrl: null,
            taxRate: item.taxRate ? Number(item.taxRate) : null,
            priceNet2: null,
            priceNet3: null,
          });
        }
      }

      navigate(`/shop?modify=${order.id}`);
    } catch (e: unknown) {
      toast.error(t("orders.modify_error") + ": " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setModifyLoadingId(null);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const feeInfo = useMemo(() => {
    const formatterHour = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hour12: false,
    });
    const formatterTime = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
    });
    const formatterDate = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    // Get today's date string in Europe/Berlin (YYYY-MM-DD)
    const berlinDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(currentTime); // en-CA gives YYYY-MM-DD format

    const hour = parseInt(formatterHour.format(currentTime), 10) % 24;
    const timeFormatted = formatterTime.format(currentTime);

    let refundPercentage = 0;
    let feePercentage = 0;
    let isDeliveryDay = false;
    let isPastDeliveryDay = false;
    let deliveryDateFormatted: string | null = null;

    if (cancelOrderId && orders) {
      const order = orders.find((o) => o.id === cancelOrderId);
      if (order) {
        const deliveryVal = order.deliveryDate || order.preferredDeliveryDay;

        if (deliveryVal) {
          try {
            const deliveryDate = new Date(deliveryVal as string | number | Date);
            if (!isNaN(deliveryDate.getTime())) {
              // Get delivery date as YYYY-MM-DD in Berlin timezone
              const deliveryDateStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Berlin",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(deliveryDate);

              deliveryDateFormatted = formatterDate.format(deliveryDate);

              if (berlinDateStr < deliveryDateStr) {
                // Future delivery → full refund
                refundPercentage = 100;
                feePercentage = 0;
              } else if (berlinDateStr === deliveryDateStr) {
                // It's the delivery day → apply time-based rules
                isDeliveryDay = true;
                if (hour < 12) {
                  refundPercentage = 100;
                } else if (hour < 21) {
                  refundPercentage = 50;
                } else {
                  refundPercentage = 0;
                }
                feePercentage = 100 - refundPercentage;
              } else {
                // Past delivery date → 0% refund, 100% fee
                isPastDeliveryDay = true;
                refundPercentage = 0;
                feePercentage = 100;
              }
            }
          } catch {
            // If date parsing fails, treat as delivery day and apply time-based rules
            isDeliveryDay = true;
            if (hour < 12) {
              refundPercentage = 100;
            } else if (hour < 21) {
              refundPercentage = 50;
            } else {
              refundPercentage = 0;
            }
            feePercentage = 100 - refundPercentage;
          }
        } else {
          // No delivery date set — treat as delivery day and apply time-based rules
          isDeliveryDay = true;
          if (hour < 12) {
            refundPercentage = 100;
          } else if (hour < 21) {
            refundPercentage = 50;
          } else {
            refundPercentage = 0;
          }
          feePercentage = 100 - refundPercentage;
        }
      }
    } else {
      // No order selected yet — compute default based on time for display
      if (hour < 12) {
        refundPercentage = 100;
      } else if (hour < 21) {
        refundPercentage = 50;
      } else {
        refundPercentage = 0;
      }
      feePercentage = 100 - refundPercentage;
    }

    let pointsRefunded = 0;
    if (cancelOrderId && orders) {
      const order = orders.find((o) => o.id === cancelOrderId);
      if (order) {
        const total = order.total ? Number(order.total) : 0;
        pointsRefunded = (total * refundPercentage) / 100;
      }
    }

    return {
      timeFormatted,
      refundPercentage,
      feePercentage,
      pointsRefunded,
      isDeliveryDay,
      isPastDeliveryDay,
      deliveryDateFormatted,
    };
  }, [currentTime, cancelOrderId, orders]);

  const confirmCancel = async () => {
    if (cancelOrderId === null) return;
    try {
      const res = await cancelOrder({ orderId: cancelOrderId });
      toast.success(t("orders.cancelled_success", { points: res.pointsRefunded, percent: res.refundPercentage }));
      setCancelOrderId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("orders.cancel_error"));
    }
  };

  const handleReorder = async (order: NonNullable<typeof orders>[number]) => {
    try {
      setReorderLoadingId(order.id);
      const products = await getProductsList({});
      clearCart();

      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          addToCart({
            productId: product.id,
            name: product.name,
            price: product.priceNet,
            quantity: item.quantity,
            photoUrl: product.photoUrl,
            taxRate: product.taxRate,
            priceNet2: product.priceNet2,
            priceNet3: product.priceNet3,
          });
        } else {
          addToCart({
            productId: item.productId || Date.now(),
            name: item.productName,
            price: Number(item.unitPrice),
            quantity: item.quantity,
            photoUrl: null,
            taxRate: item.taxRate ? Number(item.taxRate) : null,
            priceNet2: null,
            priceNet3: null,
          });
        }
      }

      toast.success(t("orders.cart_filled"));
      navigate('/checkout');
    } catch (e: unknown) {
      toast.error(t("orders.add_to_cart_error") + ": " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReorderLoadingId(null);
    }
  };

  if (isLoading) return <p>{t("orders.loading")}</p>;

  return (
    <div className={styles.viewContainer}>
      {(!orders || orders.length === 0) ? (
        <p className={styles.emptyState}>{t("orders.empty")}</p>
      ) : (
        <div className={styles.orderList}>
          {orders.map(o => (
            <div key={o.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <div className={styles.orderMeta}>
                  <div>
                    <span className={styles.orderNum}>{o.orderNumber}</span>
                    <span className={styles.orderDate}>{new Date(o.createdAt!).toLocaleDateString('de-DE')}</span>
                  </div>
                  {(o.deliveryDate || o.preferredDeliveryDay) && (
                    <div className={styles.deliveryDay}>
                      {t("orders.delivery_day")}: {(() => {
                        const val = o.deliveryDate || o.preferredDeliveryDay;
                        if (!val) return "";
                        try {
                          const date = new Date(val as string | number | Date);
                          if (isNaN(date.getTime())) return String(val);
                          return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
                        } catch {
                          return String(val);
                        }
                      })()}
                    </div>
                  )}
                </div>
                <Badge variant={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'destructive' : 'primary'}>
                  {o.status === 'pending' ? t('orders.status.pending') : o.status === 'confirmed' ? t('orders.status.confirmed') : o.status === 'delivering' ? t('orders.status.delivering') : o.status === 'delivered' ? t('orders.status.delivered') : o.status === 'cancelled' ? t('orders.status.cancelled') : o.status}
                </Badge>
              </div>
              <div className={styles.orderItems}>
                {o.items.map(i => (
                  <div key={i.id} className={styles.orderItem}>
                    <span className={styles.itemName}>
                      {i.quantity}x {i.productName.length > 35 ? i.productName.slice(0, 35) + '...' : i.productName}
                    </span>
                    <span className={styles.itemPrice}>
                      {(i.quantity * Number(i.unitPrice) * (1 + (Number(i.taxRate) || 0) / 100)).toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.orderFooter}>
                <div className={styles.orderActions}>
                  {o.status === 'pending' && (
                    <Button variant="destructive" size="sm" onClick={() => setCancelOrderId(o.id)}>
                      {t("orders.cancel")}
                    </Button>
                  )}
                  {(o.status === 'delivered' || o.status === 'cancelled') && (
                    <Button variant="outline" size="sm" disabled>
                      {t("orders.cancel")}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleModifyOrder(o)}
                    disabled={o.status !== 'pending' || !canModifyOrder(o) || modifyLoadingId === o.id}
                    title={
                      o.status !== 'pending'
                        ? t("orders.cannot_modify")
                        : o.modified
                          ? t("orders.already_modified")
                          : !canModifyOrder(o)
                            ? t("orders.modify_expired")
                            : undefined
                    }
                  >
                    {modifyLoadingId === o.id ? t("orders.loading") : t("orders.modify_order")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReorder(o)}
                    disabled={reorderLoadingId === o.id}
                  >
                    <ShoppingCart size={16} />
                    {reorderLoadingId === o.id ? t("orders.loading_reorder") : t("orders.reorder")}
                  </Button>
                                  <span className={styles.orderTotal}>
                    {t("orders.total")}: {(Number(o.total) || 0).toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={cancelOrderId !== null} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orders.cancel_title")}</DialogTitle>
            <DialogDescription asChild>
              <div>
                <span>
                  {t("orders.cancel_warning_1")}{' '}
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const files = await getSonderbereichFiles({});
                        const agbFile = files.find(f => f.title.includes("AGB"));
                        if (agbFile && agbFile.pdfUrl) {
                          const res = await fetch(agbFile.pdfUrl);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                        } else {
                          toast.error(t("orders.agb_not_found"));
                        }
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Fehler");
                      }
                    }}
                    className={styles.agbLink}
                  >{t("orders.cancel_warning_agb")}</a>{' '}
                  {t("orders.cancel_warning_2")}
                </span>

                {cancelOrderId !== null && (
                  <span className={styles.feeInfoBlock}>
                    {feeInfo.isPastDeliveryDay ? (
                      <span className={styles.feeInfo}>
                        {t("orders.past_delivery")}
                      </span>
                    ) : !feeInfo.isDeliveryDay && feeInfo.deliveryDateFormatted ? (
                      <span className={styles.noFeeInfo}>
                        {t("orders.no_fee_today", { date: feeInfo.deliveryDateFormatted })}
                      </span>
                    ) : (
                      <span className={styles.feeInfo}>
                        {t("orders.current_fee", { fee: feeInfo.feePercentage })}<br />
                        {t("orders.refund_percent", { percent: feeInfo.refundPercentage })}
                      </span>
                    )}
                    <span className={styles.pointsInfo}>
                      {t("orders.points_refund", { points: feeInfo.pointsRefunded.toFixed(2) })}
                    </span>
                    <span className={styles.timeInfo}>
                      {t("orders.current_time", { time: feeInfo.timeFormatted })}
                    </span>
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrderId(null)}>{t("profile.cancel")}</Button>
            <Button
              onClick={confirmCancel}
              className={styles.confirmCancelBtn}
            >
              {t("orders.cancel_ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};