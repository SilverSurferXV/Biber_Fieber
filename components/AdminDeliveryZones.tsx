import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  useAdminDeliveryZones, 
  useSaveAdminDeliveryZone, 
  useDeleteAdminDeliveryZone,
  useSaveAdminSettings
} from '../helpers/useAdminApi';
import { useSettings } from '../helpers/useShopApi';
import { schema as saveSchema } from '../endpoints/admin/delivery-zone/save_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Button } from './Button';
import { Switch } from './Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { toast } from 'sonner';
import styles from './AdminDeliveryZones.module.css';

export const AdminDeliveryZones = () => {
  const { data: zones } = useAdminDeliveryZones();
  const { data: settings } = useSettings();
  const { mutateAsync: saveSettings } = useSaveAdminSettings();
  const qc = useQueryClient();
  const [editingId, setEditing] = useState<number | null | 'new'>(null);
  const [globalFee, setGlobalFee] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (settings) {
      setGlobalFee(settings.deliveryFee?.toString() ?? '0');
    }
  }, [settings]);

  const handleSaveGlobalFee = async () => {
    if (!settings) return;
    try {
      await saveSettings({
        defaultLanguage: settings.defaultLanguage,
        deliveryDays: settings.deliveryDays,
        deliveryTimeWindow: settings.deliveryTimeWindow,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        openingHours: settings.openingHours,
        orderCutoffTime: settings.orderCutoffTime,
        shopLatitude: settings.shopLatitude,
        shopLocation: settings.shopLocation,
        shopLongitude: settings.shopLongitude,
        tiktokUrl: settings.tiktokUrl,
        whatsappNumber: settings.whatsappNumber,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        deliveryFee: parseFloat(globalFee) || 0,
      } as any);
      qc.invalidateQueries({ queryKey: ["shop", "settings"] });
      toast.success("Globale Liefergebühr gespeichert!");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Speichern");
    }
  };

  const activeZone = editingId === 'new' ? {} : zones?.find(z => z.id === editingId);

  const totalPopulation = zones?.reduce((sum, z) => sum + (z.population || 0), 0) || 0;
  const totalUsers = zones?.reduce((sum, z) => sum + (z.userCount || 0), 0) || 0;

  const getStatus = (z: any) => {
    return (z.activationThreshold && z.activationThreshold > 0 && z.userCount < z.activationThreshold) ? 'Inaktiv' : (z.active ? 'Aktiv' : 'Inaktiv');
  };

  const sortedZones = React.useMemo(() => {
    if (!zones) return [];
    if (!sortColumn) return zones;

    return [...zones].sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'postcode': valA = a.postcodePattern; valB = b.postcodePattern; break;
        case 'city': valA = a.cityName || ''; valB = b.cityName || ''; break;
        case 'population': valA = a.population || 0; valB = b.population || 0; break;
        case 'mov': valA = Number(a.minimumOrderValue) || 0; valB = Number(b.minimumOrderValue) || 0; break;
        case 'users': valA = a.userCount || 0; valB = b.userCount || 0; break;
        case 'threshold': valA = a.activationThreshold || 0; valB = b.activationThreshold || 0; break;
        case 'status': valA = getStatus(a); valB = getStatus(b); break;
        default: return 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [zones, sortColumn, sortDirection]);

  const renderHeader = (key: string, label: string) => {
    return (
      <th 
        className={styles.sortableHeader} 
        onClick={() => {
          if (sortColumn === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setSortColumn(key);
            setSortDirection('asc');
          }
        }}
      >
        <div className={styles.headerContent}>
          {label}
          {sortColumn === key && (
            <span className={styles.sortIndicator}>
              {sortDirection === 'asc' ? '▲' : '▼'}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Lieferzonen</h2>
        <div className={styles.headerActions}>
          <div className={styles.globalFeeRow}>
            <label htmlFor="global-fee">Liefergebühr (alle Zonen):</label>
            <Input 
              id="global-fee"
              type="number" 
              step="0.01" 
              value={globalFee} 
              onChange={e => setGlobalFee(e.target.value)} 
              className={styles.feeInput}
            />
            <Button variant="outline" size="sm" onClick={handleSaveGlobalFee}>Speichern</Button>
          </div>
          <Button onClick={() => setEditing('new')}>Neue Lieferzone</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {renderHeader('postcode', 'PLZ')}
              {renderHeader('city', 'Stadtname')}
              {renderHeader('population', 'Einwohnerzahl')}
              {renderHeader('mov', 'Mindestbestellwert')}
              {renderHeader('users', 'Kunden')}
              {renderHeader('threshold', 'Aktivierungsschwelle')}
              {renderHeader('status', 'Status')}
            </tr>
          </thead>
          <tbody>
            {zones && zones.length > 0 && (
              <tr className={styles.summaryRow}>
                <td>Gesamt</td>
                <td></td>
                <td>{totalPopulation.toLocaleString('de-DE')}</td>
                <td></td>
                <td>{totalUsers}</td>
                <td></td>
                <td></td>
              </tr>
            )}
            {sortedZones.map(z => (
              <tr key={z.id} onClick={() => setEditing(z.id)} className={styles.clickableRow}>
                <td>{z.postcodePattern}</td>
                <td>{z.cityName || '—'}</td>
                <td>{z.population?.toLocaleString('de-DE') || '—'}</td>
                <td>{Number(z.minimumOrderValue).toFixed(2)} €</td>
                <td>{z.userCount}</td>
                <td>{z.activationThreshold ? z.activationThreshold : '—'}</td>
                <td>{getStatus(z)}</td>
              </tr>
            ))}
            {(!zones || zones.length === 0) && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center' }}>Keine Lieferzonen gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent className={styles.dialogContent}>
            <DialogHeader>
              <DialogTitle>{editingId === 'new' ? 'Neue Lieferzone' : 'Lieferzone bearbeiten'}</DialogTitle>
            </DialogHeader>
            <AdminDeliveryZoneForm zone={activeZone} onClose={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const AdminDeliveryZoneForm = ({ zone, onClose }: { zone: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminDeliveryZone();
  const { mutateAsync: del } = useDeleteAdminDeliveryZone();
  
  const form = useForm({
    defaultValues: {
      id: zone?.id,
      postcodePattern: zone?.postcodePattern || '',
      cityName: zone?.cityName || '',
      population: zone?.population ?? undefined,
      activationThreshold: zone?.activationThreshold ?? 0,
      minimumOrderValue: zone?.minimumOrderValue ?? 0,
      active: zone?.active ?? true,
    },
    schema: saveSchema
  });

  const { data: coords } = useQuery({
    queryKey: ['osm-coords', form.values.postcodePattern, form.values.cityName],
    queryFn: async () => {
      const p = form.values.postcodePattern?.trim();
      const c = form.values.cityName?.trim();
      if (!p && !c) return null;
      
      const query = encodeURIComponent(`${p} ${c} Germany`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      if (!res.ok) return null;
      
      const json = await res.json();
      if (json && json.length > 0) {
        return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
      }
      return null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Lieferzone gespeichert!");
      onClose();
    } catch(e: any) { 
      toast.error(e.message || "Fehler beim Speichern"); 
    }
  };

  const mapUrl = coords 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon-0.1},${coords.lat-0.1},${coords.lon+0.1},${coords.lat+0.1}&layer=mapnik&marker=${coords.lat},${coords.lon}` 
    : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        
        <div className={styles.mapContainer}>
          {mapUrl ? (
            <iframe 
              src={mapUrl} 
              width="100%" 
              height="200" 
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              title="Kartenansicht"
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              <p>Geben Sie eine Postleitzahl und/oder Stadt ein, um die Karte zu sehen.</p>
            </div>
          )}
        </div>

        <div className={styles.inputRow}>
          <FormItem name="postcodePattern" className={styles.flex1}>
            <FormLabel>Postleitzahl</FormLabel>
            <FormControl>
              <Input 
                value={form.values.postcodePattern} 
                onChange={e => form.setValues(p => ({...p, postcodePattern: e.target.value}))} 
                placeholder="z.B. 10115, 10* oder 81241-81249"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="cityName" className={styles.flex1}>
            <FormLabel>Stadtname</FormLabel>
            <FormControl>
              <Input 
                value={form.values.cityName || ''} 
                onChange={e => form.setValues(p => ({...p, cityName: e.target.value || undefined}))} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="population">
          <FormLabel>Einwohnerzahl</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              value={form.values.population ?? ''} 
              onChange={e => form.setValues(p => ({
                ...p, 
                population: e.target.value === '' ? undefined : parseInt(e.target.value, 10)
              }))} 
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="activationThreshold">
          <FormLabel>Aktivierungsschwelle</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              value={form.values.activationThreshold ?? 0} 
              onChange={e => form.setValues(p => ({
                ...p, 
                activationThreshold: e.target.value === '' ? 0 : parseInt(e.target.value, 10)
              }))} 
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="minimumOrderValue">
          <FormLabel>Mindestbestellwert (€)</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              step="0.01" 
              value={form.values.minimumOrderValue ?? ''} 
              onChange={e => form.setValues(p => ({...p, minimumOrderValue: parseFloat(e.target.value) || 0}))} 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        
        <div style={{ display:'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                    <Switch 
            checked={form.values.active} 
            onCheckedChange={v => form.setValues(p => ({...p, active: v, ...(v ? { activationThreshold: 0 } : {})}))} 
            id="active-toggle"
          />
          <label htmlFor="active-toggle" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Aktiv</label>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
          {zone?.id && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={async () => { 
                if (window.confirm('Möchten Sie diese Lieferzone wirklich löschen?')) {
                  await del({id: zone.id}); 
                  onClose(); 
                }
              }}
            >
              Löschen
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};