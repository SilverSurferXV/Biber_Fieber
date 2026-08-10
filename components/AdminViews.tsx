import React, { useState } from 'react';
import { 
  useAdminCategories, useSaveAdminCategory,
  useSaveAdminSettings,
  useAdminSonderbereichFiles, useSaveAdminSonderbereichFile, useDeleteAdminSonderbereichFile
} from '../helpers/useAdminApi';
import { useSettings } from '../helpers/useShopApi';
import { schema as categorySchema } from '../endpoints/admin/category/save_POST.schema';
import { schema as settingsSchema } from '../endpoints/admin/settings/save_POST.schema';
import { schema as sonderbereichSchema } from '../endpoints/admin/sonderbereich/save_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { AdminEmailSignatures } from './AdminEmailSignatures';
import { Input } from './Input';
import { Checkbox } from './Checkbox';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Switch } from './Switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { toast } from 'sonner';
import styles from './AdminViews.module.css';

export { AdminOrders } from './AdminOrders';
export { AdminCustomers } from './AdminCustomers';
export { AdminProducts } from './AdminProducts';

export const AdminCategories = () => {
  const { data: categories } = useAdminCategories();
  const [editingId, setEditing] = useState<number | null | 'new'>(null);

  const activeObj = editingId === 'new' ? {} : categories?.find(c => c.id === editingId);

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Kategorien</h2>
        <Button onClick={() => setEditing('new')}>Neue Kategorie</Button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Sortierung</th><th>Status</th><th>Aktionen</th></tr></thead>
          <tbody>
            {categories?.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.sortOrder}</td>
                <td>{c.active ? 'Aktiv' : 'Inaktiv'}</td>
                <td><Button variant="outline" size="sm" onClick={() => setEditing(c.id)}>Bearbeiten</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId === 'new' ? 'Neu' : 'Bearbeiten'}</DialogTitle></DialogHeader>
            <AdminCategoryForm category={activeObj} onClose={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
};

const AdminCategoryForm = ({ category, onClose }: { category: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminCategory();
  const [imageFileName, setImageFileName] = useState<string>("");

  const form = useForm({
    defaultValues: {
      id: category?.id,
      name: category?.name || '',
      nameEn: category?.nameEn ?? null,
      nameEs: category?.nameEs ?? null,
      nameIt: category?.nameIt ?? null,
      nameTr: category?.nameTr ?? null,
      photoUrl: category?.photoUrl ?? null,
      sortOrder: category?.sortOrder ?? null,
      active: category?.active ?? true,
    },
    schema: categorySchema
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setImageFileName(f.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        form.setValues(p => ({ ...p, photoUrl: event.target?.result as string }));
      };
      reader.readAsDataURL(f);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Gespeichert!");
      onClose();
    } catch(e: any) { toast.error(e.message); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <FormItem name="name">
          <FormLabel>Name</FormLabel>
          <FormControl><Input value={form.values.name} onChange={e => form.setValues(p => ({...p, name: e.target.value}))}/></FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.sectionBox} style={{ padding: 'var(--spacing-4)' }}>
          <h3 style={{ fontSize: '1rem' }}>Übersetzungen</h3>
          <FormItem name="nameEn">
            <FormLabel>Name (Englisch)</FormLabel>
            <FormControl><Input value={form.values.nameEn || ''} onChange={e => form.setValues(p => ({...p, nameEn: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="nameEs">
            <FormLabel>Name (Español)</FormLabel>
            <FormControl><Input value={form.values.nameEs || ''} onChange={e => form.setValues(p => ({...p, nameEs: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="nameIt">
            <FormLabel>Name (Italiano)</FormLabel>
            <FormControl><Input value={form.values.nameIt || ''} onChange={e => form.setValues(p => ({...p, nameIt: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="nameTr">
            <FormLabel>Name (Türkçe)</FormLabel>
            <FormControl><Input value={form.values.nameTr || ''} onChange={e => form.setValues(p => ({...p, nameTr: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="photoUrl">
          <FormLabel>Kategoriefoto</FormLabel>
          <FormControl>
            <Input type="file" accept="image/*" onChange={handleImageChange} />
          </FormControl>
          {imageFileName && <div style={{ fontSize: '0.875rem', marginTop: 'var(--spacing-1)' }}>Ausgewählt: {imageFileName}</div>}
          {!imageFileName && form.values.photoUrl && (
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <img 
                src={form.values.photoUrl} 
                alt="Vorschau" 
                style={{ maxHeight: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} 
              />
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 'var(--spacing-1)' }}>
            Bitte nur kleine Bilder hochladen (max. ~2MB).
          </div>
          <FormMessage />
        </FormItem>
        <FormItem name="sortOrder">
          <FormLabel>Reihenfolge</FormLabel>
          <FormControl><Input type="number" value={form.values.sortOrder ?? ''} onChange={e => form.setValues(p => ({...p, sortOrder: e.target.value === '' ? null : parseInt(e.target.value, 10)}))}/></FormControl>
          <FormMessage />
        </FormItem>
        
        <div style={{display:'flex', alignItems: 'center', gap: '8px', marginTop: '16px'}}>
          <Switch checked={form.values.active} onCheckedChange={v => form.setValues(p => ({...p, active: v}))} />
          <span>Aktiv</span>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Form>
  )
};

const WEEKDAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
];

const AdminSettingsForm = ({ settings }: { settings: any }) => {
  const { mutateAsync: save } = useSaveAdminSettings();
  const form = useForm({
    defaultValues: {
      defaultLanguage: settings.defaultLanguage ?? null,
      deliveryDays: settings.deliveryDays ?? {},
      deliveryTimeWindow: settings.deliveryTimeWindow ?? null,
            freeDeliveryThreshold: settings.freeDeliveryThreshold ?? 25,
      deliveryFee: settings.deliveryFee ?? null,
      facebookUrl: settings.facebookUrl ?? null,
      instagramUrl: settings.instagramUrl ?? null,
      openingHours: settings.openingHours ?? {},
      orderCutoffTime: settings.orderCutoffTime ?? null,
      shopLatitude: settings.shopLatitude ?? null,
      shopLocation: settings.shopLocation ?? null,
      shopLongitude: settings.shopLongitude ?? null,
      tiktokUrl: settings.tiktokUrl ?? null,
      whatsappNumber: settings.whatsappNumber ?? null,
      youtubeUrl: settings.youtubeUrl ?? null,
    },
    schema: settingsSchema
  });

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Einstellungen gespeichert!");
    } catch(e: any) { toast.error(e.message); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        
        <div className={styles.sectionBox}>
          <h3>Allgemein</h3>
          <FormItem name="defaultLanguage">
            <FormLabel>Standardsprache</FormLabel>
            <FormControl>
              <Select 
                value={form.values.defaultLanguage || "_empty"}
                onValueChange={v => form.setValues(p => ({...p, defaultLanguage: v === "_empty" ? null : v as "de" | "en" | "es" | "it" | "tr"}))}
              >
                <SelectTrigger><SelectValue placeholder="Sprache wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">Keine</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="tr">Türkçe</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="whatsappNumber">
            <FormLabel>WhatsApp Nummer</FormLabel>
            <FormControl><Input value={form.values.whatsappNumber || ''} onChange={e => form.setValues(p => ({...p, whatsappNumber: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.sectionBox}>
          <h3>Bestellung & Lieferung</h3>
          <FormItem name="orderCutoffTime">
            <FormLabel>Bestellschluss (Uhrzeit)</FormLabel>
            <FormControl><Input type="time" value={form.values.orderCutoffTime || ''} onChange={e => form.setValues(p => ({...p, orderCutoffTime: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="deliveryTimeWindow">
            <FormLabel>Lieferzeitfenster (z.B. 08:00 - 12:00)</FormLabel>
            <FormControl><Input value={form.values.deliveryTimeWindow || ''} onChange={e => form.setValues(p => ({...p, deliveryTimeWindow: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="freeDeliveryThreshold">
            <FormLabel>Summe für Lieferkostenfrei (€)</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                step="0.01" 
                min="0" 
                value={form.values.freeDeliveryThreshold ?? ''} 
                onChange={e => form.setValues(p => ({...p, freeDeliveryThreshold: e.target.value === '' ? null : parseFloat(e.target.value)}))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="deliveryDays">
            <FormLabel>Liefertage</FormLabel>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap', marginTop: 'var(--spacing-2)' }}>
            {WEEKDAYS.map(day => (
              <label key={day.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer' }}>
                <Checkbox 
                  checked={form.values.deliveryDays?.[day.key] ?? false}
                  onChange={e => {
                    const checked = e.target.checked;
                    form.setValues(p => ({
                      ...p,
                      deliveryDays: {
                        ...(p.deliveryDays || {}),
                        [day.key]: checked
                      }
                    }))
                  }}
                />
                <span style={{ fontSize: '0.875rem' }}>{day.label}</span>
              </label>
            ))}
            </div>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.sectionBox}>
          <h3>Social Media Links</h3>
          <FormItem name="facebookUrl">
            <FormLabel>Facebook URL</FormLabel>
            <FormControl><Input value={form.values.facebookUrl || ''} onChange={e => form.setValues(p => ({...p, facebookUrl: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="instagramUrl">
            <FormLabel>Instagram URL</FormLabel>
            <FormControl><Input value={form.values.instagramUrl || ''} onChange={e => form.setValues(p => ({...p, instagramUrl: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="tiktokUrl">
            <FormLabel>TikTok URL</FormLabel>
            <FormControl><Input value={form.values.tiktokUrl || ''} onChange={e => form.setValues(p => ({...p, tiktokUrl: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="youtubeUrl">
            <FormLabel>YouTube URL</FormLabel>
            <FormControl><Input value={form.values.youtubeUrl || ''} onChange={e => form.setValues(p => ({...p, youtubeUrl: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.sectionBox}>
          <h3>Standort</h3>
          <FormItem name="shopLocation">
            <FormLabel>Adresse (als Text)</FormLabel>
            <FormControl><Textarea value={form.values.shopLocation || ''} onChange={e => form.setValues(p => ({...p, shopLocation: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <FormItem name="shopLatitude" style={{ flex: 1 }}>
              <FormLabel>Breitengrad (Latitude)</FormLabel>
              <FormControl><Input type="number" step="any" value={form.values.shopLatitude ?? ''} onChange={e => form.setValues(p => ({...p, shopLatitude: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="shopLongitude" style={{ flex: 1 }}>
              <FormLabel>Längengrad (Longitude)</FormLabel>
              <FormControl><Input type="number" step="any" value={form.values.shopLongitude ?? ''} onChange={e => form.setValues(p => ({...p, shopLongitude: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
              <FormMessage />
            </FormItem>
          </div>
        </div>

        <div className={styles.sectionBox}>
          <h3>Öffnungszeiten</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {WEEKDAYS.map(day => {
              const dayData = form.values.openingHours?.[day.key] || { active: false, open: '', close: '' };
              return (
                <div key={day.key} style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                  <Switch 
                    checked={dayData.active} 
                    onCheckedChange={v => form.setValues(p => ({
                      ...p, 
                      openingHours: {
                        ...(p.openingHours || {}),
                        [day.key]: { ...dayData, active: v }
                      }
                    }))} 
                  />
                  <span style={{ width: '100px', fontSize: '0.875rem' }}>{day.label}</span>
                  <Input 
                    type="time" 
                    value={dayData.open || ''} 
                    onChange={e => form.setValues(p => ({
                      ...p, 
                      openingHours: {
                        ...(p.openingHours || {}),
                        [day.key]: { ...dayData, open: e.target.value }
                      }
                    }))} 
                    disabled={!dayData.active}
                    style={{ width: '120px' }}
                  />
                  <span style={{ color: 'var(--muted-foreground)' }}>-</span>
                  <Input 
                    type="time" 
                    value={dayData.close || ''} 
                    onChange={e => form.setValues(p => ({
                      ...p, 
                      openingHours: {
                        ...(p.openingHours || {}),
                        [day.key]: { ...dayData, close: e.target.value }
                      }
                    }))}
                    disabled={!dayData.active} 
                    style={{ width: '120px' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Einstellungen speichern</Button>
        </div>
      </form>
    </Form>
  )
}

export const AdminSettings = () => {
  const { data: settings, isLoading } = useSettings();
  if (isLoading) return <p>Lade Einstellungen...</p>;
  if (!settings) return null;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Globale Einstellungen</h2>
      </div>
      <p>Hier können Shop-URL, Zeiten und Social Links konfiguriert werden.</p>
      <AdminSettingsForm settings={settings} />
      <hr style={{ margin: 'var(--spacing-8) 0', borderColor: 'var(--border)' }} />
      <AdminEmailSignatures />
    </div>
  )
};

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const AdminSonderbereich = () => {
  const { data: files } = useAdminSonderbereichFiles();
  const [editingId, setEditing] = useState<number | null | 'new'>(null);

  const activeObj = editingId === 'new' ? {} : files?.find(f => f.id === editingId);

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Sonderbereich Dateien</h2>
        <Button onClick={() => setEditing('new')}>Neue Datei</Button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Anzeigename</th><th>Dateigröße</th><th>Status</th><th>Aktionen</th></tr></thead>
          <tbody>
            {files?.map(f => (
              <tr key={f.id}>
                <td>{f.title}</td>
                <td>{f.fileSize != null ? formatBytes(Number(f.fileSize)) : 'Unbekannt'}</td>
                <td>{f.active ? 'Aktiv' : 'Inaktiv'}</td>
                <td><Button variant="outline" size="sm" onClick={() => setEditing(f.id)}>Bearbeiten</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId === 'new' ? 'Neue Datei' : 'Datei bearbeiten'}</DialogTitle></DialogHeader>
            <AdminSonderbereichForm file={activeObj} onClose={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
};

const AdminSonderbereichForm = ({ file, onClose }: { file: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminSonderbereichFile();
  const { mutateAsync: del } = useDeleteAdminSonderbereichFile();
  const [fileName, setFileName] = useState<string>("");

  const form = useForm({
    defaultValues: {
      id: file?.id,
      title: file?.title || '',
      description: file?.description ?? null,
      pdfUrl: file?.pdfUrl || '',
      fileSize: file?.fileSize != null ? Number(file.fileSize) : null,
      active: file?.active ?? true,
    },
    schema: sonderbereichSchema
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileName(f.name);
      form.setValues(p => ({ ...p, fileSize: f.size }));
      const reader = new FileReader();
      reader.onload = (event) => {
        form.setValues(p => ({ ...p, pdfUrl: event.target?.result as string }));
      };
      reader.readAsDataURL(f);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Gespeichert!");
      onClose();
    } catch(e: any) { toast.error(e.message); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <FormItem name="title">
          <FormLabel>Anzeigename</FormLabel>
          <FormControl><Input value={form.values.title} onChange={e => form.setValues(p => ({...p, title: e.target.value}))}/></FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="description">
          <FormLabel>Beschreibung</FormLabel>
          <FormControl>
            <Textarea value={form.values.description || ''} onChange={e => form.setValues(p => ({...p, description: e.target.value || null}))} />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="pdfUrl">
          <FormLabel>PDF-Datei</FormLabel>
          <FormControl>
            <Input type="file" accept=".pdf" onChange={handleFileChange} />
          </FormControl>
          {fileName && <div style={{ fontSize: '0.875rem', marginTop: 'var(--spacing-1)' }}>Ausgewählt: {fileName}</div>}
          {!fileName && file?.pdfUrl && <div style={{ fontSize: '0.875rem', marginTop: 'var(--spacing-1)' }}>Bestehende Datei wird verwendet</div>}
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 'var(--spacing-1)' }}>
            PDF wird automatisch in den Dateispeicher hochgeladen.
          </div>
          <FormMessage />
        </FormItem>
        
        <div style={{display:'flex', alignItems: 'center', gap: '8px', marginTop: '16px'}}>
          <Switch checked={form.values.active} onCheckedChange={v => form.setValues(p => ({...p, active: v}))} />
          <span>Aktiv</span>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
          {file?.id && <Button type="button" variant="destructive" onClick={async () => { if(window.confirm('Wirklich löschen?')){ await del({id: file.id}); onClose(); } }}>Löschen</Button>}
        </div>
      </form>
    </Form>
  )
};