import React, { useState } from 'react';
import { useSaveAdminProduct, useDeleteAdminProduct } from '../helpers/useAdminApi';
import { schema as productSchema } from '../endpoints/admin/product/save_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Switch } from './Switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Dialog, DialogContent } from './Dialog';
import { toast } from 'sonner';
import { useAdminSuppliers } from '../helpers/useAdminSuppliers';
import styles from './AdminViews.module.css';
import localStyles from './AdminProducts.module.css';

export const AdminProductForm = ({ product, categories, onClose }: { product: any, categories: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminProduct();
  const { mutateAsync: del } = useDeleteAdminProduct();
  const { data: suppliers } = useAdminSuppliers();
  const [imageFileName, setImageFileName] = useState<string>("");
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const form = useForm({
    defaultValues: {
      id: product?.id,
      name: product?.name || '',
      weight: product?.weight ?? null,
      articleNumber: product?.articleNumber || '',
      categoryId: product?.categoryId ?? null,
      description: product?.description ?? null,
      externalUrl: product?.externalUrl ?? null,
      photoUrl: product?.photoUrl ?? null,
      priceNet: product?.priceNet != null ? parseFloat(product.priceNet) : 0,
      priceNet2: product?.priceNet2 != null ? parseFloat(product.priceNet2) : null,
      priceNet3: product?.priceNet3 != null ? parseFloat(product.priceNet3) : null,
      taxRate: product?.taxRate != null ? parseFloat(product.taxRate) : null,
      costPriceEuro: product?.costPriceEuro != null ? parseFloat(product.costPriceEuro) : null,
      costPriceEuro2: product?.costPriceEuro2 != null ? parseFloat(product.costPriceEuro2) : null,
      costPriceEuro3: product?.costPriceEuro3 != null ? parseFloat(product.costPriceEuro3) : null,
      costPricePercent: product?.costPricePercent != null ? parseFloat(product.costPricePercent) : null,
      active: product?.active ?? true,
      isNew: product?.isNew ?? false,
      isVegan: product?.isVegan ?? false,
      isBio: product?.isBio ?? false,
      isGlutenFree: product?.isGlutenFree ?? false,
      isVegetarian: product?.isVegetarian ?? false,
      supplier: product?.supplier ?? null,
      sortOrder: product?.sortOrder ?? null,
      quantityDiscounts: product?.quantityDiscounts ?? null,
      newDurationDays: product?.newDurationDays != null ? Number(product.newDurationDays) : null,
      originalPhotoSizeBytes: product?.originalPhotoSizeBytes ?? null,
      compressedPhotoSizeBytes: product?.compressedPhotoSizeBytes ?? null,
    },
    schema: productSchema
  });

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + "MB";
    return (bytes / 1024).toFixed(0) + "KB";
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const originalSize = f.size;
    setImageFileName("Wird komprimiert...");
    setIsCompressing(true);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(f);
      img.src = objectUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxSize = 1200;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(img, 0, 0, width, height);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82)
      );

      if (!blob) throw new Error("Compression failed");

      const compressedSize = blob.size;

      const reader = new FileReader();
      reader.onload = (event) => {
        form.setValues(p => ({ ...p, photoUrl: event.target?.result as string, originalPhotoSizeBytes: originalSize, compressedPhotoSizeBytes: compressedSize }));
        setImageFileName(f.name);
        setIsCompressing(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Image compression error:", error);
      toast.error("Fehler bei der Bildkomprimierung.");
      setImageFileName(f.name);
      setIsCompressing(false);
      // Fallback to original file
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

  const taxMultiplier = 1 + (form.values.taxRate || 0) / 100;
  const brutto1 = (form.values.priceNet || 0) * taxMultiplier;
  const brutto2 = form.values.priceNet2 != null ? form.values.priceNet2 * taxMultiplier : null;
  const brutto3 = form.values.priceNet3 != null ? form.values.priceNet3 * taxMultiplier : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <FormItem name="name">
          <FormLabel>Name</FormLabel>
          <FormControl><Input value={form.values.name} onChange={e => form.setValues(p => ({...p, name: e.target.value}))}/></FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="weight">
          <FormLabel>Gewicht</FormLabel>
          <FormControl><Input value={form.values.weight || ''} onChange={e => form.setValues(p => ({...p, weight: e.target.value || null}))}/></FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="articleNumber">
          <FormLabel>Artikelnummer</FormLabel>
          <FormControl><Input value={form.values.articleNumber} onChange={e => form.setValues(p => ({...p, articleNumber: e.target.value}))}/></FormControl>
          <FormMessage />
        </FormItem>
        
        <FormItem name="categoryId">
          <FormLabel>Kategorie</FormLabel>
          <FormControl>
            <Select 
              value={form.values.categoryId?.toString() || "_empty"} 
              onValueChange={v => form.setValues(p => ({...p, categoryId: v === "_empty" ? null : parseInt(v, 10)}))}
            >
              <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_empty">Keine</SelectItem>
                {categories?.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="supplier">
          <FormLabel>Lieferant</FormLabel>
          <FormControl>
            <Select
              value={form.values.supplier || "_empty"}
              onValueChange={v => form.setValues(p => ({...p, supplier: v === "_empty" ? null : v}))}
            >
              <SelectTrigger><SelectValue placeholder="Lieferant wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_empty">Keine</SelectItem>
                {suppliers?.filter((s: any) => s.active).map((s: any) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="description">
          <FormLabel>Beschreibung</FormLabel>
          <FormControl>
            <Textarea value={form.values.description || ''} onChange={e => form.setValues(p => ({...p, description: e.target.value || null}))} />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <FormItem name="priceNet" style={{ flex: 1 }}>
            <FormLabel>Preis Netto (1) (€)</FormLabel>
            <FormControl><Input type="number" step="0.001" value={form.values.priceNet ?? ''} onChange={e => form.setValues(p => ({...p, priceNet: parseFloat(e.target.value) || 0}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="priceNet2" style={{ flex: 1 }}>
            <FormLabel>Preis Netto (2) (€)</FormLabel>
            <FormControl><Input type="number" step="0.001" value={form.values.priceNet2 ?? ''} onChange={e => form.setValues(p => ({...p, priceNet2: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="priceNet3" style={{ flex: 1 }}>
            <FormLabel>Preis Netto (3) (€)</FormLabel>
            <FormControl><Input type="number" step="0.001" value={form.values.priceNet3 ?? ''} onChange={e => form.setValues(p => ({...p, priceNet3: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>
        <FormItem name="taxRate">
          <FormLabel>Steuersatz (%)</FormLabel>
          <FormControl><Input type="number" step="0.1" value={form.values.taxRate ?? ''} onChange={e => form.setValues(p => ({...p, taxRate: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
          <FormMessage />
        </FormItem>
        
        <div style={{ padding: "var(--spacing-2)", backgroundColor: "var(--background)", borderRadius: "var(--radius-sm)", fontSize: "0.875rem" }}>
          <strong>Berechneter Brutto-Preis:</strong>{' '}
          Brutto (1): {brutto1.toFixed(2)} €
          {brutto2 != null && ` | Brutto (2): ${brutto2.toFixed(2)} €`}
          {brutto3 != null && ` | Brutto (3): ${brutto3.toFixed(2)} €`}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <FormItem name="costPriceEuro" style={{ flex: 1 }}>
            <FormLabel>Einkaufspreis (1) (€)</FormLabel>
            <FormControl><Input type="number" step="0.01" value={form.values.costPriceEuro ?? ''} onChange={e => form.setValues(p => ({...p, costPriceEuro: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="costPriceEuro2" style={{ flex: 1 }}>
            <FormLabel>Einkaufspreis (2) (€)</FormLabel>
            <FormControl><Input type="number" step="0.01" value={form.values.costPriceEuro2 ?? ''} onChange={e => form.setValues(p => ({...p, costPriceEuro2: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="costPriceEuro3" style={{ flex: 1 }}>
            <FormLabel>Einkaufspreis (3) (€)</FormLabel>
            <FormControl><Input type="number" step="0.01" value={form.values.costPriceEuro3 ?? ''} onChange={e => form.setValues(p => ({...p, costPriceEuro3: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>
        
        <div style={{ padding: "var(--spacing-2)", backgroundColor: "var(--background)", borderRadius: "var(--radius-sm)", fontSize: "0.875rem", marginBottom: "var(--spacing-2)" }}>
          <strong>Wareneinsatz:</strong>{' '}
          (1): {form.values.priceNet && form.values.costPriceEuro != null ? ((form.values.costPriceEuro / form.values.priceNet) * 100).toFixed(2) + ' %' : '–'}
          {form.values.priceNet2 != null && form.values.costPriceEuro2 != null && ` | (2): ${((form.values.costPriceEuro2 / form.values.priceNet2) * 100).toFixed(2)} %`}
          {form.values.priceNet3 != null && form.values.costPriceEuro3 != null && ` | (3): ${((form.values.costPriceEuro3 / form.values.priceNet3) * 100).toFixed(2)} %`}
        </div>

        <div style={{ padding: "var(--spacing-2)", backgroundColor: "var(--background)", borderRadius: "var(--radius-sm)", fontSize: "0.875rem", marginBottom: "var(--spacing-4)" }}>
          <strong>DB1:</strong>{' '}
          (1): {form.values.priceNet != null && form.values.costPriceEuro != null ? (form.values.priceNet - form.values.costPriceEuro).toFixed(2) + ' €' : '–'}
          {form.values.priceNet2 != null && form.values.costPriceEuro2 != null && ` | (2): ${(form.values.priceNet2 - form.values.costPriceEuro2).toFixed(2)} €`}
          {form.values.priceNet3 != null && form.values.costPriceEuro3 != null && ` | (3): ${(form.values.priceNet3 - form.values.costPriceEuro3).toFixed(2)} €`}
        </div>

        <FormItem name="externalUrl">
          <FormLabel>Externer Link</FormLabel>
          <FormControl><Input value={form.values.externalUrl || ''} onChange={e => form.setValues(p => ({...p, externalUrl: e.target.value || null}))}/></FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="photoUrl">
          <FormLabel>Produktfoto</FormLabel>
          <FormControl>
            <Input type="file" accept="image/*" onChange={handleImageChange} disabled={isCompressing} />
          </FormControl>
          {imageFileName && <div style={{ fontSize: '0.875rem', marginTop: 'var(--spacing-1)' }}>Ausgewählt: {imageFileName}</div>}
          {form.values.photoUrl && (
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <img 
                src={form.values.photoUrl} 
                alt="Vorschau" 
                loading="lazy"
                onClick={() => setShowFullImage(true)}
                style={{ maxHeight: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', cursor: 'pointer' }} 
              />
              <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
                <DialogContent style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-4)' }}>
                  <img src={form.values.photoUrl} alt="Produktfoto" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
                </DialogContent>
              </Dialog>
              {form.values.originalPhotoSizeBytes != null && form.values.compressedPhotoSizeBytes != null && (
                <div className={localStyles.compressionInfoBox}>
                  <div>Original: {formatSize(form.values.originalPhotoSizeBytes)}</div>
                  <div>Komprimiert: {formatSize(form.values.compressedPhotoSizeBytes)}</div>
                  <div>
                    Ersparnis: <span className={localStyles.compressionSavings}>{Math.round((1 - form.values.compressedPhotoSizeBytes / form.values.originalPhotoSizeBytes) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 'var(--spacing-1)' }}>
            Fotos werden automatisch komprimiert.
          </div>
          <FormMessage />
        </FormItem>

        
        
        <div style={{display:'flex', flexDirection: 'column', gap: '12px', marginTop: '16px'}}>
          <div style={{display:'flex', flexWrap: 'wrap', gap: '16px'}}>
            <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
              <Switch checked={form.values.isVegan} onCheckedChange={v => form.setValues(p => ({...p, isVegan: v}))} />
              <span>Vegan 🌱</span>
            </div>
            <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
              <Switch checked={form.values.isBio} onCheckedChange={v => form.setValues(p => ({...p, isBio: v}))} />
              <span>Bio 🌿</span>
            </div>
            <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
              <Switch checked={form.values.isGlutenFree} onCheckedChange={v => form.setValues(p => ({...p, isGlutenFree: v}))} />
              <span>Glutenfrei 🌾</span>
            </div>
            <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
              <Switch checked={form.values.isVegetarian} onCheckedChange={v => form.setValues(p => ({...p, isVegetarian: v}))} />
              <span>Vegetarisch 🥬</span>
            </div>
          </div>
          <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
            <Switch checked={form.values.active} onCheckedChange={v => form.setValues(p => ({...p, active: v}))} />
            <span>Aktiv</span>
          </div>
          <div style={{display:'flex', alignItems: 'center', gap: '8px'}}>
            <Switch checked={form.values.isNew} onCheckedChange={v => form.setValues(p => ({...p, isNew: v, newDurationDays: v ? p.newDurationDays : null}))} />
            <span>Produkt als NEU markieren</span>
          </div>
          {form.values.isNew && (
            <FormItem name="newDurationDays">
              <FormLabel>Wie lange als NEU anzeigen?</FormLabel>
              <FormControl>
                <Select
                  value={form.values.newDurationDays?.toString() ?? "_empty"}
                  onValueChange={v => form.setValues(p => ({...p, newDurationDays: v === "_empty" ? null : parseInt(v, 10)}))}
                >
                  <SelectTrigger><SelectValue placeholder="Dauer wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Tage</SelectItem>
                    <SelectItem value="14">14 Tage</SelectItem>
                    <SelectItem value="21">21 Tage</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        </div>

        <div className={styles.formActions}>
          <Button type="submit" disabled={isCompressing}>Speichern</Button>
          {product?.id && <Button type="button" variant="destructive" onClick={async () => { await del({id: product.id}); onClose(); }}>Löschen</Button>}
        </div>
      </form>
    </Form>
  )
};