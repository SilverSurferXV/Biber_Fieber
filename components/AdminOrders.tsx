import React, { useState, useEffect } from 'react';
import { useAdminOrders } from '../helpers/useAdminApi';
import { useAdminDrivers } from '../helpers/useAdminDriverApi';
import { useUpdateOrderStatus } from '../helpers/useUpdateOrderStatus';
import { useDeleteAdminOrder } from '../helpers/useDeleteAdminOrder';
import { useAdminZoneDriverAssignments, useSaveAdminZoneDriverAssignment } from '../helpers/useAdminZoneDriverAssignments';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { toast } from 'sonner';
import { Printer, ChevronRight } from 'lucide-react';
import { getEffectiveDeliveryDay } from '../helpers/getEffectiveDeliveryDay';
import { generatePdf, generatePdf4x6, formatDeliveryDay } from '../helpers/adminOrdersPdf';

import styles from './AdminViews.module.css';
import localStyles from './AdminOrders.module.css';

const STATUS_MAP: Record<string, string> = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  delivering: 'In Zustellung',
  delivered: 'Geliefert',
  cancelled: 'Storniert',
};

const DeliveryNoteCell = ({ note }: { note?: string | null }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!note) return <>-</>;

  const isLong = note.length > 60;

  return (
    <div className={localStyles.noteCell}>
      <div className={localStyles.noteText}>{note}</div>
      {isLong && (
        <>
          <Button variant="link" size="sm" onClick={() => setIsOpen(true)} className={localStyles.moreBtn}>
            mehr anzeigen
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Bemerkung</DialogTitle></DialogHeader>
                            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--foreground)', wordBreak: 'break-word', overflowY: 'auto', maxHeight: '60vh' }}>
                {note}
              </div>
              <div className={styles.formActions} style={{ marginTop: 'var(--spacing-4)' }}>
                <Button onClick={() => setIsOpen(false)}>Schließen</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export const AdminOrders = () => {
  const [page, setPage] = useState(1);
  const { data } = useAdminOrders({ page });
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { mutateAsync: deleteOrder, isPending: isDeleting } = useDeleteAdminOrder();
  const { mutateAsync: saveAssignment } = useSaveAdminZoneDriverAssignment();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showA4DayPicker, setShowA4DayPicker] = useState(false);
  const [selectedA4Day, setSelectedA4Day] = useState<string | null>(null);
  const [show4x6DayPicker, setShow4x6DayPicker] = useState(false);
  const [selected4x6Day, setSelected4x6Day] = useState<string | null>(null);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [zoneDrivers, setZoneDrivers] = useState<Record<string, number>>({});
  const [zoneCarType, setZoneCarType] = useState<Record<string, string>>({});
  const [zonePacker, setZonePacker] = useState<Record<string, string>>({});

  const { data: driversData } = useAdminDrivers();

  const toggleZone = (zoneKey: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(zoneKey)) next.delete(zoneKey);
      else next.add(zoneKey);
      return next;
    });
  };

  const uniqueDays = React.useMemo(() => {
    if (!data?.orders) return [];
    const days = new Set(data.orders.map(o => getEffectiveDeliveryDay(o)).filter(Boolean) as string[]);
    return Array.from(days).sort();
  }, [data?.orders]);

  const handlePrintA4 = async (day: string | null) => {
    if (!data?.orders) return;
    setSelectedA4Day(day);
    const filtered = day ? data.orders.filter(o => getEffectiveDeliveryDay(o) === day) : data.orders;
    await generatePdf(filtered);
    setShowA4DayPicker(false);
    setSelectedA4Day(null);
  };

  const handlePrint4x6 = async (day: string | null) => {
    if (!data?.orders) return;
    setSelected4x6Day(day);
    const filtered = day ? data.orders.filter(o => getEffectiveDeliveryDay(o) === day) : data.orders;
    await generatePdf4x6(filtered);
    setShow4x6DayPicker(false);
    setSelected4x6Day(null);
  };

const groupedOrders = React.useMemo(() => {
  if (!data?.orders) return [];
  const groups = data.orders.reduce((acc, order) => {
    const dDay = getEffectiveDeliveryDay(order) || 'kein-liefertag';
    const dateStr = dDay;
    const d = dDay === 'kein-liefertag' ? new Date(0) : new Date(dDay);
    if (!acc[dateStr]) acc[dateStr] = { dateStr, date: d, orders: [], totalBetrag: 0, avgWareneinsatz: null, totalDB1: 0, zoneGroups: [], openCount: 0 };
    acc[dateStr].orders.push(order);
    return acc;
  }, {} as Record<string, { dateStr: string; date: Date; orders: typeof data.orders; totalBetrag: number; avgWareneinsatz: number | null; totalDB1: number, zoneGroups: { postcode: string; orders: typeof data.orders; totalBetrag: number }[]; openCount: number }>);
    
    Object.values(groups).forEach(g => {
      g.totalBetrag = g.orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const wOrders = g.orders.filter(o => o.wareneinsatz != null);
      g.avgWareneinsatz = wOrders.length > 0 ? wOrders.reduce((sum, o) => sum + Number(o.wareneinsatz), 0) / wOrders.length : null;
      g.totalDB1 = g.orders.reduce((sum, o) => sum + Number(o.db1 || 0), 0);
      g.openCount = g.orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

      const zones = g.orders.reduce((zAcc, o) => {
        const postcode = o.customerPostcode || 'Unbekannt';
        if (!zAcc[postcode]) zAcc[postcode] = { postcode, orders: [], totalBetrag: 0 };
        zAcc[postcode].orders.push(o);
        zAcc[postcode].totalBetrag += Number(o.total || 0);
        return zAcc;
      }, {} as Record<string, { postcode: string; orders: typeof data.orders; totalBetrag: number }>);

      g.zoneGroups = Object.values(zones).sort((a, b) => a.postcode.localeCompare(b.postcode));
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data?.orders]);

  const dateKeys = React.useMemo(() => {
    return groupedOrders.map(g => g.dateStr).join(',');
  }, [groupedOrders]);

  const { data: assignmentsData } = useAdminZoneDriverAssignments(dateKeys);

  useEffect(() => {
    if (assignmentsData) {
      const newDrivers: Record<string, number> = {};
      const newCarTypes: Record<string, string> = {};
      const newPackers: Record<string, string> = {};
      assignmentsData.forEach(a => {
        const key = `${a.dateKey}-${a.postcode}`;
        if (a.driverId != null) newDrivers[key] = a.driverId;
        if (a.carType != null) newCarTypes[key] = a.carType;
        if (a.packer != null) newPackers[key] = a.packer;
      });
      setZoneDrivers(newDrivers);
      setZoneCarType(newCarTypes);
      setZonePacker(newPackers);
    }
  }, [assignmentsData]);

  const handleMarkDelivered = async (orderId: number) => {
    try {
      await updateStatus({ orderId, status: 'delivered' });
      toast.success('Bestellung als geliefert markiert');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (window.confirm('Bestellung wirklich löschen? Alle zugehörigen Daten werden angepasst.')) {
      try {
        await deleteOrder({ orderId });
        toast.success('Bestellung erfolgreich gelöscht');
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  };
  
  const handleDriverChange = async (zoneKey: string, val: string) => {
    const parts = zoneKey.split('-');
    const dateKey = parts.slice(0, 3).join('-');
    const postcode = parts.slice(3).join('-');
    
    const driverId = Number(val);
    const carType = zoneCarType[zoneKey] || null;
    const packer = zonePacker[zoneKey] as any;

    setZoneDrivers(prev => ({ ...prev, [zoneKey]: driverId }));

    try {
      await saveAssignment({ dateKey, postcode, driverId, carType, packer });
      toast.success('Fahrer zugewiesen');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    }
  };

  const handleCarTypeChange = async (zoneKey: string, val: string) => {
    const parts = zoneKey.split('-');
    const dateKey = parts.slice(0, 3).join('-');
    const postcode = parts.slice(3).join('-');

    const driverId = zoneDrivers[zoneKey] || null;
    const packer = zonePacker[zoneKey] as any;

    setZoneCarType(prev => ({ ...prev, [zoneKey]: val }));

    try {
      await saveAssignment({ dateKey, postcode, driverId, carType: val, packer });
      toast.success('Fahrzeugart gespeichert');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    }
  };

  const handlePackerChange = async (zoneKey: string, val: string) => {
    const parts = zoneKey.split('-');
    const dateKey = parts.slice(0, 3).join('-');
    const postcode = parts.slice(3).join('-');

    const driverId = zoneDrivers[zoneKey] || null;
    const carType = zoneCarType[zoneKey] || null;

    setZonePacker(prev => ({ ...prev, [zoneKey]: val }));

    try {
      await saveAssignment({ dateKey, postcode, driverId, carType, packer: val as any });
      toast.success('Verpacker gespeichert');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={styles.viewContainer}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-6)' }}>
        <h2 style={{ margin: 0 }}>Bestellungen (Letzte Tage)</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <Button variant="outline" onClick={() => setShowA4DayPicker(true)} disabled={!data?.orders}>
            <Printer size={16} style={{ marginRight: 'var(--spacing-2)' }} />
            Drucken / A4
          </Button>
          <Button variant="outline" onClick={() => setShow4x6DayPicker(true)} disabled={!data?.orders}>
            <Printer size={16} style={{ marginRight: 'var(--spacing-2)' }} />
            Drucken / 4x6
          </Button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
    {groupedOrders.map((group, index) => (
      <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <h3 className={`${localStyles.groupHeading} ${group.dateStr === todayStr ? localStyles.todayGroup : ''}`.trim()}>
          {group.openCount > 0 && <Badge variant="destructive">{group.openCount}</Badge>}
          <span>
            {group.dateStr === 'kein-liefertag' 
              ? 'Kein Liefertag' 
              : new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(group.date)}
          </span>
        </h3>
            <div className={styles.tableWrapper}>
              <table className={`${styles.table} ${localStyles.smallTable}`}>
                <thead><tr><th>Uhrzeit</th><th>Kunde</th><th>Bestellnummer</th><th>Betrag</th><th>Wareneinsatz</th><th>DB1</th><th>Liefertag</th><th>Bemerkung</th><th>Status</th><th>Aktionen</th></tr></thead>
                <tbody>
                  <tr className={localStyles.summaryRow}>
                    <td>Gesamt</td>
                    <td></td>
                    <td></td>
                    <td>{group.totalBetrag.toFixed(2)} €</td>
                    <td>{group.avgWareneinsatz != null ? `${(group.avgWareneinsatz * 100).toFixed(2)} %` : '-'}</td>
                    <td>{group.totalDB1.toFixed(2)} €</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  {group.zoneGroups.map(zg => {
                    const zoneKey = `${group.dateStr}-${zg.postcode}`;
                    const isExpanded = expandedZones.has(zoneKey);
                    return (
                    <React.Fragment key={zg.postcode}>
                      <tr 
                        className={localStyles.zoneHeaderRow}
                        onClick={() => toggleZone(zoneKey)}
                      >
                        <td colSpan={10}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <ChevronRight 
                                size={16} 
                                className={`${localStyles.zoneChevron} ${isExpanded ? localStyles.zoneChevronOpen : ''}`} 
                              />
                              PLZ: {zg.postcode} — {zg.orders.length} Bestellung{zg.orders.length !== 1 ? 'en' : ''} — {zg.totalBetrag.toFixed(2)} €
                            </div>
                            <div className={localStyles.driverSelectWrapper} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                <Select 
                                  value={zoneDrivers[zoneKey]?.toString() || undefined} 
                                  onValueChange={(val) => handleDriverChange(zoneKey, val)}
                                >
                                  <SelectTrigger className={localStyles.driverSelect}>
                                    <SelectValue placeholder="Fahrer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {driversData?.map(d => (
                                      <SelectItem key={d.id} value={d.id.toString()}>
                                        {d.firstName} {d.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select 
                                  value={zoneCarType[zoneKey] || undefined} 
                                  onValueChange={(val) => handleCarTypeChange(zoneKey, val)}
                                >
                                  <SelectTrigger className={localStyles.driverSelect}>
                                    <SelectValue placeholder="Car" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="company">Company Car</SelectItem>
                                    <SelectItem value="private">Private Car</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select 
                                  value={zonePacker[zoneKey] || undefined} 
                                  onValueChange={(val) => handlePackerChange(zoneKey, val)}
                                >
                                  <SelectTrigger className={localStyles.driverSelect}>
                                    <SelectValue placeholder="Verpacker" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="zentrale">Zentrale</SelectItem>
                                    {driversData?.map(d => (
                                      <SelectItem key={d.id} value={d.id.toString()}>
                                        {d.firstName} {d.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && zg.orders.map(o => (
                        <tr key={o.id}>
                          <td>{new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(o.createdAt!))}</td>
                          <td>{o.customerName || '-'}</td>
                      <td>{o.orderNumber}</td>
                      <td>{Number(o.total).toFixed(2)} €</td>
                      <td>{o.wareneinsatz != null ? `${(Number(o.wareneinsatz) * 100).toFixed(2)} %` : '-'}</td>
                      <td>{o.db1 != null ? `${Number(o.db1).toFixed(2)} €` : '-'}</td>
                      <td>{formatDeliveryDay(getEffectiveDeliveryDay(o))}</td>
                      <td><DeliveryNoteCell note={o.deliveryNote} /></td>
                          <td>{STATUS_MAP[o.status!] || o.status}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>Details</Button>
                              {o.status !== 'delivered' && (
                                <Button variant="outline" size="sm" disabled={isUpdating || isDeleting} onClick={() => handleMarkDelivered(o.id)}>Geliefert</Button>
                              )}
                              <Button variant="destructive" size="sm" disabled={isDeleting} onClick={() => handleDeleteOrder(o.id)}>Löschen</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Zurück</Button>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Seite {data.page} von {data.totalPages} ({data.totalCount} Bestellungen)</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>Weiter</Button>
        </div>
      )}

      {show4x6DayPicker && (
        <Dialog open={true} onOpenChange={setShow4x6DayPicker}>
          <DialogContent>
            <DialogHeader><DialogTitle>Liefertag für 4x6-Druck wählen</DialogTitle></DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <Button variant="outline" onClick={() => handlePrint4x6(null)}>Alle Liefertage</Button>
              {uniqueDays.map(day => (
                <Button key={day} variant="outline" onClick={() => handlePrint4x6(day)}>
                  {formatDeliveryDay(day)}
                </Button>
              ))}
            </div>
            <div className={styles.formActions} style={{ marginTop: 'var(--spacing-4)' }}>
              <Button variant="ghost" onClick={() => setShow4x6DayPicker(false)}>Abbrechen</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showA4DayPicker && (
        <Dialog open={true} onOpenChange={setShowA4DayPicker}>
          <DialogContent>
            <DialogHeader><DialogTitle>Liefertag für A4-Druck wählen</DialogTitle></DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <Button variant="outline" onClick={() => handlePrintA4(null)}>Alle Liefertage</Button>
              {uniqueDays.map(day => (
                <Button key={day} variant="outline" onClick={() => handlePrintA4(day)}>
                  {formatDeliveryDay(day)}
                </Button>
              ))}
            </div>
            <div className={styles.formActions} style={{ marginTop: 'var(--spacing-4)' }}>
              <Button variant="ghost" onClick={() => setShowA4DayPicker(false)}>Abbrechen</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedOrder && (
        <Dialog open={true} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Bestellung {selectedOrder.orderNumber}</DialogTitle></DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', color: 'var(--foreground)' }}>
              <div>
                <strong>Datum:</strong> {new Date(selectedOrder.createdAt!).toLocaleString('de-DE')}<br/>
                <strong>Kunde:</strong> {selectedOrder.customerName || '-'}<br/>
                <strong>Liefertag:</strong> {formatDeliveryDay(getEffectiveDeliveryDay(selectedOrder))}<br/>
                <strong>Bemerkung:</strong> {selectedOrder.deliveryNote || '-'}<br/>
                <strong>Status:</strong> {STATUS_MAP[selectedOrder.status!] || selectedOrder.status}
              </div>
              <div>
                <strong>Positionen:</strong>
                <ul style={{ margin: 'var(--spacing-2) 0', paddingLeft: 'var(--spacing-4)' }}>
                  {selectedOrder.items?.map((item: any) => (
                    <li key={item.id}>
                      {item.quantity}x {item.productName} ({Number(item.unitPrice).toFixed(2)} €)
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Zwischensumme:</strong> {Number(selectedOrder.subtotal).toFixed(2)} €<br/>
                <strong>Liefergebühr:</strong> {Number(selectedOrder.deliveryFee).toFixed(2)} €<br/>
                <strong>Punkte genutzt:</strong> {Number(selectedOrder.pointsUsed || 0).toFixed(2)} €<br/>
                <strong>Gesamt:</strong> {Number(selectedOrder.total).toFixed(2)} €
              </div>
              <div className={styles.formActions}>
                <Button onClick={() => setSelectedOrder(null)}>Schließen</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
};