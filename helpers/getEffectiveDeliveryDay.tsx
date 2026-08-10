export const getEffectiveDeliveryDay = (order: { deliveryDate?: Date | string | null, preferredDeliveryDay?: string | null } | any): string | null => {
  if (order.deliveryDate) {
    const d = new Date(order.deliveryDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return order.preferredDeliveryDay || null;
};