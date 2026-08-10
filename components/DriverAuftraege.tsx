import React, { useState } from 'react';
import { PackageX, Map as MapIcon, CheckCircle, Phone, Route, Share, Navigation, Smartphone, MapPin, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useRouteOptimization, LAGER_ALLING_ADDRESS } from '../helpers/useRouteOptimization';
import { useDriverOrders, useMarkOrderDelivered } from '../helpers/useDriverOrders';
import { Progress } from './Progress';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { DriverOrder } from '../endpoints/driver/orders_GET.schema';
import styles from './DriverAuftraege.module.css';

const getCurrentPosition = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Standort wird von diesem Browser nicht unterstützt."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error("Fehler beim Abrufen des Standorts. Bitte überprüfe deine Berechtigungen."));
      }
    );
  });
};

export function DriverAuftraege() {
  const { data, isLoading } = useDriverOrders();
  const { mutate: markDelivered, isPending: isMarkingDelivered } = useMarkOrderDelivered();
  const { optimizeRoute, isOptimizing } = useRouteOptimization();

  const [optimizedOrdersMap, setOptimizedOrdersMap] = useState<Record<string, number[]>>({});
  const [activeTab, setActiveTab] = useState<string>('alle');
  const [startPoint, setStartPoint] = useState<'lager' | 'zuhause' | 'standort'>('lager');
  const [endPoint, setEndPoint] = useState<'lager' | 'zuhause' | 'standort'>('lager');
  
  const [showRouteShareDialog, setShowRouteShareDialog] = useState(false);
  
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner size="lg" />
      </div>
    );
  }

  const orders = data?.orders;
  const driverAddress = data?.driverAddress;

  if (!orders || orders.length === 0) {
    return (
      <div className={styles.emptyStateContainer}>
        <PackageX size={64} className={styles.emptyIcon} />
        <h2>Keine Lieferungen</h2>
        <p>Du hast heute keine Lieferungen zugewiesen bekommen.</p>
      </div>
    );
  }

  type Stop = {
    addressKey: string;
    postcode: string;
    street: string;
    customerName: string;
    mobileNumber: string | null;
    dropoffDescription: string | null;
    dropoffPhotoUrl: string | null;
    orders: DriverOrder[];
  };

  const stopsRecord: Record<string, DriverOrder[]> = {};
  orders.forEach((order: DriverOrder) => {
    const addressKey = [order.customer.streetAddress, order.customer.postcode, order.customer.city].filter(Boolean).join(', ');
    if (!stopsRecord[addressKey]) stopsRecord[addressKey] = [];
    stopsRecord[addressKey].push(order);
  });

  const stops: Stop[] = Object.entries(stopsRecord).map(([addressKey, stopOrders]) => {
    const first = stopOrders[0];
    return {
      addressKey,
      postcode: first.customer.postcode || '',
      street: first.customer.streetAddress || '',
      customerName: [first.customer.firstName, first.customer.lastName].filter(Boolean).join(' ') || 'Unbekannt',
      mobileNumber: first.customer.mobileNumber,
      dropoffDescription: first.customer.dropoffDescription,
      dropoffPhotoUrl: first.customer.dropoffPhotoUrl,
      orders: stopOrders,
    };
  });

  stops.sort((a, b) => {
    if (a.postcode !== b.postcode) return a.postcode.localeCompare(b.postcode);
    return a.street.localeCompare(b.street);
  });

  const uniquePostcodes = Array.from(new Set(orders.map((o: DriverOrder) => o.customer.postcode || 'Unbekannt'))).sort();
  const tabs = ['alle', ...uniquePostcodes];
  const showTabs = uniquePostcodes.length > 1;

  const filteredStops = activeTab === 'alle' ? stops : stops.filter(s => s.postcode === activeTab);
  const currentOptimizedOrder = optimizedOrdersMap[activeTab];

  const sortedStops = currentOptimizedOrder 
    ? currentOptimizedOrder.map(i => filteredStops[i]).filter(Boolean)
    : filteredStops;

  const totalStops = sortedStops.length;
  const completedStops = sortedStops.filter((s: Stop) => s.orders.every((o: DriverOrder) => o.status === "delivered")).length;
  const progressPercent = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  const getAddressForPoint = async (point: 'lager' | 'zuhause' | 'standort'): Promise<string | null> => {
    if (point === 'lager') {
      return LAGER_ALLING_ADDRESS;
    }
    if (point === 'zuhause') {
      if (!driverAddress?.streetAddress || !driverAddress?.postcode || !driverAddress?.city) {
        toast.error("Deine Adresse ist unvollständig. Bitte wähle das Lager als Start-/Endpunkt.");
        return null;
      }
      return `${driverAddress.streetAddress}, ${driverAddress.postcode} ${driverAddress.city}`;
    }
    if (point === 'standort') {
      try {
        const coords = await getCurrentPosition();
        return `COORDS:${coords.lat},${coords.lon}`;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fehler beim Abrufen des Standorts.");
        return null;
      }
    }
    return LAGER_ALLING_ADDRESS;
  };

  const formatAddressForUrl = (address: string) => {
    if (address.startsWith("COORDS:")) {
      return address.replace("COORDS:", "");
    }
    return encodeURIComponent(address);
  };

  const handleOptimize = async (): Promise<boolean> => {
    const startAddr = await getAddressForPoint(startPoint);
    if (!startAddr) return false;
    
    const endAddr = await getAddressForPoint(endPoint);
    if (!endAddr) return false;

    const deliveredIndices = filteredStops
      .map((s, i) => ({ stop: s, originalIndex: i }))
      .filter(({ stop }) => stop.orders.every(o => o.status === "delivered"))
      .map(item => item.originalIndex);

    const undeliveredIndices = filteredStops
      .map((s, i) => ({ stop: s, originalIndex: i }))
      .filter(({ stop }) => !stop.orders.every(o => o.status === "delivered"));

    if (undeliveredIndices.length === 0) {
      toast.error("Alle Stops sind bereits geliefert.");
      return false;
    }

    const stopsForOptimization = undeliveredIndices.map(item => ({ address: item.stop.addressKey }));
    const order = await optimizeRoute(stopsForOptimization, startAddr, endAddr);
    if (order) {
      const mappedOrder = order.map(i => undeliveredIndices[i].originalIndex);
      // Prepend delivered stops to preserve them in the UI and keep progress calculation intact
      setOptimizedOrdersMap(prev => ({
        ...prev,
        [activeTab]: [...deliveredIndices, ...mappedOrder]
      }));
      return true;
    }
    return false;
  };

  const handleShareClick = async () => {
    if (!optimizedOrdersMap[activeTab]) {
      const success = await handleOptimize();
      if (!success) return;
    }
    setShowRouteShareDialog(true);
  };

  const handleReset = () => {
    setOptimizedOrdersMap(prev => {
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });
  };

  const undeliveredStops = sortedStops.filter(s => !s.orders.every(o => o.status === "delivered"));

  const handleShareGoogleMaps = async () => {
    if (undeliveredStops.length === 0) {
      toast.error("Alle Stops sind bereits geliefert.");
      setShowRouteShareDialog(false);
      return;
    }
    
    const startAddr = await getAddressForPoint(startPoint);
    if (!startAddr) return;
    
    const endAddr = await getAddressForPoint(endPoint);
    if (!endAddr) return;

    const waypoints = undeliveredStops.map(s => encodeURIComponent(s.addressKey)).join('/');
    const url = `https://www.google.com/maps/dir/${formatAddressForUrl(startAddr)}/${waypoints}/${formatAddressForUrl(endAddr)}`;
    
    window.open(url, '_blank');
    setShowRouteShareDialog(false);
  };

  const handleShareAppleMaps = async () => {
    if (undeliveredStops.length === 0) {
      toast.error("Alle Stops sind bereits geliefert.");
      setShowRouteShareDialog(false);
      return;
    }
    
    const startAddr = await getAddressForPoint(startPoint);
    if (!startAddr) return;
    
    const endAddr = await getAddressForPoint(endPoint);
    if (!endAddr) return;

    const waypoints = undeliveredStops.map(s => encodeURIComponent(s.addressKey)).join('+to:');
    const url = `http://maps.apple.com/?saddr=${formatAddressForUrl(startAddr)}&daddr=${waypoints}+to:${formatAddressForUrl(endAddr)}`;
    
    window.open(url, '_blank');
    setShowRouteShareDialog(false);
  };

  const handleShareWaze = async () => {
    const firstUndelivered = sortedStops.find(s => !s.orders.every(o => o.status === "delivered"));
    if (firstUndelivered) {
      const url = `https://waze.com/ul?q=${encodeURIComponent(firstUndelivered.addressKey)}&navigate=yes`;
      window.open(url, '_blank');
    } else {
      toast.error("Alle Stops sind bereits geliefert.");
    }
    setShowRouteShareDialog(false);
  };

  const handleSharePetalMaps = async () => {
    const firstUndelivered = sortedStops.find(s => !s.orders.every(o => o.status === "delivered"));
    if (firstUndelivered) {
      const url = `https://www.petalmaps.com/navigate/?daddr=${encodeURIComponent(firstUndelivered.addressKey)}&type=drive`;
      window.open(url, '_blank');
    } else {
      toast.error("Alle Stops sind bereits geliefert.");
    }
    setShowRouteShareDialog(false);
  };

  const handleShareYandexMaps = async () => {
    if (undeliveredStops.length === 0) {
      toast.error("Alle Stops sind bereits geliefert.");
      setShowRouteShareDialog(false);
      return;
    }
    
    const startAddr = await getAddressForPoint(startPoint);
    if (!startAddr) return;
    
    const endAddr = await getAddressForPoint(endPoint);
    if (!endAddr) return;

    const waypoints = undeliveredStops.map(s => formatAddressForUrl(s.addressKey));
    const rtext = [formatAddressForUrl(startAddr), ...waypoints, formatAddressForUrl(endAddr)].join('~');
    const url = `https://yandex.com/maps/?rtext=${rtext}&rtt=auto`;
    
    window.open(url, '_blank');
    setShowRouteShareDialog(false);
  };

  const handleShareText = async () => {
    if (undeliveredStops.length === 0) {
      toast.error("Alle Stops sind bereits geliefert.");
      setShowRouteShareDialog(false);
      return;
    }
    const dateStr = new Date().toLocaleDateString('de-DE');
    const title = `🚚 Lieferroute ${dateStr}`;
    
    let text = `${title}\n\n`;
    
    undeliveredStops.forEach((stop: Stop, index: number) => {
      text += `Stop ${index + 1}: ${stop.customerName}\n`;
      text += `${stop.addressKey}\n`;
      if (stop.mobileNumber) text += `Mobil: ${stop.mobileNumber}\n`;
      if (stop.dropoffDescription) text += `Ablageort: ${stop.dropoffDescription}\n`;
      
      stop.orders.forEach((order: DriverOrder) => {
        const itemsStr = order.items.map((i: DriverOrder["items"][0]) => `${i.quantity}x ${i.productName}`).join(', ');
        text += `Bestellung #${order.orderNumber}: ${itemsStr}\n`;
      });
      
      text += '\n';
    });
    
    text += `Gesamt: ${undeliveredStops.length} Stops`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: title,
          text: text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Route in die Zwischenablage kopiert');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Error sharing route:", err);
        toast.error("Fehler beim Teilen der Route");
      }
    }
    setShowRouteShareDialog(false);
  };

  return (
    <div className={styles.auftraegeContainer}>
      {showTabs && (
        <div className={styles.tabsContainer}>
          {tabs.map(tab => {
            const tabStops = tab === 'alle' ? stops : stops.filter(s => s.postcode === tab);
            const count = tabStops.length;
            return (
              <button
                key={tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'alle' ? 'Alle' : tab} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.routeOptimizationCard}>
        <div className={styles.routeOptimizationHeader}>
          <Route size={20} />
          <h3>Routenplanung</h3>
        </div>
        <div className={styles.routeOptimizationControls}>
          <div className={styles.selectGroup}>
            <label>Startpunkt</label>
            <select 
              className={styles.routeSelect} 
              value={startPoint} 
              onChange={(e) => setStartPoint(e.target.value as 'lager' | 'zuhause' | 'standort')}
            >
              <option value="lager">Lager 1 Alling</option>
              <option value="zuhause">Mein Zuhause</option>
              <option value="standort">Mein Standort</option>
            </select>
          </div>
          <div className={styles.selectGroup}>
            <label>Endpunkt</label>
            <select 
              className={styles.routeSelect} 
              value={endPoint} 
              onChange={(e) => setEndPoint(e.target.value as 'lager' | 'zuhause' | 'standort')}
            >
              <option value="lager">Lager 1 Alling</option>
              <option value="zuhause">Mein Zuhause</option>
              <option value="standort">Mein Standort</option>
            </select>
          </div>
          <div className={styles.routeActions}>
            <div className={styles.optimizeGroup}>
              <Button 
                className={`${styles.optimizeBtn} ${optimizedOrdersMap[activeTab] ? styles.optimizeBtnActive : ''}`} 
                onClick={handleOptimize} 
                disabled={isOptimizing}
              >
                {isOptimizing ? <><Spinner size="sm" /> Optimieren...</> : optimizedOrdersMap[activeTab] ? "✓ Route Optimiert!" : "Route optimieren"}
              </Button>
              {optimizedOrdersMap[activeTab] && (
                <Button 
                  variant="secondary" 
                  className={styles.resetBtn} 
                  onClick={handleReset}
                >
                  Zurücksetzen
                </Button>
              )}
            </div>
            {sortedStops.length > 0 && (
              <Button 
                className={styles.shareBtn} 
                onClick={handleShareClick}
                disabled={isOptimizing}
              >
                {isOptimizing ? <><Spinner size="sm" /> Optimieren...</> : <><Share size={16} /> Sende Route an</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showRouteShareDialog} onOpenChange={setShowRouteShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Route senden an...</DialogTitle>
          </DialogHeader>
          <div className={styles.routeShareOptions}>
            <button className={styles.routeShareOption} onClick={handleShareGoogleMaps}>
              <MapIcon className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Google Maps</span>
                <span className={styles.routeShareOptionDesc}>Route in Google Maps öffnen</span>
              </div>
            </button>
            <button className={styles.routeShareOption} onClick={handleShareAppleMaps}>
              <Smartphone className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Apple Maps</span>
                <span className={styles.routeShareOptionDesc}>Route in Apple Maps öffnen</span>
              </div>
            </button>
            <button className={styles.routeShareOption} onClick={handleShareWaze}>
              <Navigation className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Waze</span>
                <span className={styles.routeShareOptionDesc}>Route in Waze öffnen</span>
              </div>
            </button>
            <button className={styles.routeShareOption} onClick={handleSharePetalMaps}>
              <MapPin className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Petal Maps</span>
                <span className={styles.routeShareOptionDesc}>Route in Petal Maps öffnen (Einzelziel)</span>
              </div>
            </button>
            <button className={styles.routeShareOption} onClick={handleShareYandexMaps}>
              <Globe className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Yandex Maps</span>
                <span className={styles.routeShareOptionDesc}>Route in Yandex Maps öffnen</span>
              </div>
            </button>
            <button className={styles.routeShareOption} onClick={handleShareText}>
              <Share className={styles.routeShareOptionIcon} />
              <div className={styles.routeShareOptionText}>
                <span className={styles.routeShareOptionTitle}>Als Text teilen</span>
                <span className={styles.routeShareOptionDesc}>Route als Nachricht teilen</span>
              </div>
            </button>
          </div>
          <p className={styles.routeShareNote}>Hinweis: Waze und Petal Maps unterstützen nur Einzelziel-Navigation. Apple Maps Multi-Stop funktioniert nur auf Apple-Geräten.</p>
        </DialogContent>
      </Dialog>

      <div className={styles.progressContainer}>
        <div className={styles.progressHeader}>
          <h3 className={styles.progressTitle}>Routenfortschritt</h3>
          <p className={styles.progressText}>
            {completedStops} von {totalStops} Stops erledigt
          </p>
        </div>
        <Progress value={progressPercent} />
      </div>

      <div className={styles.stopsList}>
        {sortedStops.map((stop: Stop, index: number) => {
          const isStopCompleted = stop.orders.every((o: DriverOrder) => o.status === "delivered");
          
          return (
            <div key={stop.addressKey} className={styles.stopCard}>
              <div className={styles.stopHeader}>
                <span className={styles.stopNumber}>Stop {index + 1}</span>
                {isStopCompleted && (
                  <span className={styles.stopCompletedBadge}>
                    <CheckCircle size={16} /> Erledigt
                  </span>
                )}
              </div>
              <div className={styles.stopContent}>
                <h3 className={styles.customerName}>{stop.customerName}</h3>
                <p className={styles.address}>{stop.addressKey}</p>
                {stop.mobileNumber && (
                  <a href={`tel:${stop.mobileNumber}`} className={styles.phoneLink}>
                    <Phone size={16} /> {stop.mobileNumber}
                  </a>
                )}

                {(stop.dropoffDescription || stop.dropoffPhotoUrl) && (
                  <div className={styles.noteBlock}>
                    {stop.dropoffDescription && (
                      <p>
                        <strong>Ablageort:</strong> {stop.dropoffDescription}
                      </p>
                    )}
                    {stop.dropoffPhotoUrl && (
                      <a href={stop.dropoffPhotoUrl} target="_blank" rel="noreferrer">
                        <img 
                          src={stop.dropoffPhotoUrl} 
                          alt="Ablageort Foto" 
                          className={styles.dropoffPhoto} 
                        />
                      </a>
                    )}
                  </div>
                )}

                <div className={styles.orderItems}>
                  {stop.orders.map((order: DriverOrder) => {
                    const isExpanded = expandedOrders.includes(order.id);
                    return (
                    <div key={order.id} className={styles.orderBlock}>
                      <button 
                        className={styles.orderTitleRow} 
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        <h4 className={styles.orderTitle}>Bestellung #{order.orderNumber}</h4>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>

                      <div className={`${styles.collapsibleContent} ${isExpanded ? styles.expanded : ''}`}>
                        <div className={styles.collapsibleContentInner}>
                          {order.deliveryNote && (
                            <div className={styles.noteBlock}>
                              <p>
                                <strong>Hinweis:</strong> {order.deliveryNote}
                              </p>
                            </div>
                          )}
                          
                          <ul className={styles.orderItemsList}>
                            {order.items.map((item: DriverOrder["items"][0], i: number) => (
                              <li key={i}>
                                {item.quantity}x {item.productName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {order.status === "delivered" ? (
                        <div className={styles.deliveredBadge}>
                          <CheckCircle size={20} /> Geliefert
                        </div>
                      ) : (
                        <div className={styles.btnRow}>
                          <button
                            className={styles.startBtn}
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.addressKey)}`, '_blank')}
                          >
                            <MapIcon size={24} /> Start
                          </button>
                          <button
                            className={styles.deliverBtn}
                            onClick={() => markDelivered(order.id)}
                            disabled={isMarkingDelivered}
                          >
                            <CheckCircle size={24} /> Geliefert
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}