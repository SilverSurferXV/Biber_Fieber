import React, { useState } from 'react';
import { useAdminSuppliers, useSaveAdminSupplier, useDeleteAdminSupplier } from '../helpers/useAdminSuppliers';
import { schema as saveSchema } from '../endpoints/admin/supplier/save_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Switch } from './Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Skeleton } from './Skeleton';
import { toast } from 'sonner';
import styles from './AdminViews.module.css';
import localStyles from './AdminSuppliers.module.css';

export const AdminSuppliers = () => {
  const { data: suppliers, isLoading } = useAdminSuppliers();
  const { mutateAsync: del } = useDeleteAdminSupplier();
  const [editingId, setEditingId] = useState<number | null | 'new'>(null);

  const activeSupplier = editingId === 'new' ? {} : suppliers?.find(s => s.id === editingId);

  if (isLoading) {
    return (
      <div className={`${styles.viewContainer} ${localStyles.container}`}>
        <div className={styles.header}>
          <h2>Lieferanten</h2>
          <Skeleton style={{ width: '150px', height: '2.5rem' }} />
        </div>
        <div className={styles.tableWrapper}>
          <Skeleton style={{ height: '300px', borderRadius: 'var(--radius-sm)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.viewContainer} ${localStyles.container}`}>
      <div className={styles.header}>
        <h2>Lieferanten</h2>
        <Button onClick={() => setEditingId('new')}>Neuer Lieferant</Button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kontaktperson</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {suppliers?.map(supplier => (
              <tr key={supplier.id}>
                <td>{supplier.name}</td>
                <td>{supplier.contactPerson || '—'}</td>
                <td>{supplier.email || '—'}</td>
                <td>{supplier.phone || '—'}</td>
                <td>{supplier.active ? 'Aktiv' : 'Inaktiv'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(supplier.id)}>
                      Bearbeiten
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={async () => {
                        if (window.confirm("Lieferant wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.")) {
                          try {
                            await del({ id: supplier.id });
                            toast.success("Lieferant erfolgreich gelöscht!");
                          } catch (e: unknown) {
                            if (e instanceof Error) {
                              toast.error(e.message || "Fehler beim Löschen");
                            }
                          }
                        }
                      }}
                    >
                      Löschen
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                  Keine Lieferanten gefunden. Legen Sie einen neuen Lieferanten an.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId === 'new' ? 'Neuer Lieferant' : 'Lieferant bearbeiten'}
              </DialogTitle>
            </DialogHeader>
            <AdminSupplierForm 
              supplier={activeSupplier} 
              onClose={() => setEditingId(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const AdminSupplierForm = ({ supplier, onClose }: { supplier: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminSupplier();

  const form = useForm({
    defaultValues: {
      id: supplier?.id,
      name: supplier?.name || '',
      contactPerson: supplier?.contactPerson || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      notes: supplier?.notes || '',
      active: supplier?.active ?? true,
    },
    schema: saveSchema
  });

  const onSubmit = async (data: any) => {
    try {
      // Clean up empty strings to null mapping to match nullable database schema expectations
      const payload = {
        ...data,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
      };

      await save(payload);
      toast.success("Lieferant erfolgreich gespeichert!");
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message || "Fehler beim Speichern");
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <FormItem name="name">
          <FormLabel>Name *</FormLabel>
          <FormControl>
            <Input 
              value={form.values.name} 
              onChange={e => form.setValues(p => ({ ...p, name: e.target.value }))} 
              placeholder="z.B. Bio-Hof Müller"
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="contactPerson">
          <FormLabel>Kontaktperson</FormLabel>
          <FormControl>
            <Input 
              value={form.values.contactPerson || ''} 
              onChange={e => form.setValues(p => ({ ...p, contactPerson: e.target.value }))} 
              placeholder="Vor- und Nachname"
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
          <FormItem name="email" style={{ flex: 1 }}>
            <FormLabel>E-Mail</FormLabel>
            <FormControl>
              <Input 
                type="email"
                value={form.values.email || ''} 
                onChange={e => form.setValues(p => ({ ...p, email: e.target.value }))} 
                placeholder="info@beispiel.de"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="phone" style={{ flex: 1 }}>
            <FormLabel>Telefon</FormLabel>
            <FormControl>
              <Input 
                value={form.values.phone || ''} 
                onChange={e => form.setValues(p => ({ ...p, phone: e.target.value }))} 
                placeholder="+49 123 45678"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="address">
          <FormLabel>Adresse</FormLabel>
          <FormControl>
            <Textarea 
              value={form.values.address || ''} 
              onChange={e => form.setValues(p => ({ ...p, address: e.target.value }))} 
              placeholder="Straße, PLZ, Ort"
              rows={2}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="notes">
          <FormLabel>Interne Notizen</FormLabel>
          <FormControl>
            <Textarea 
              value={form.values.notes || ''} 
              onChange={e => form.setValues(p => ({ ...p, notes: e.target.value }))} 
              placeholder="Bemerkungen, Lieferzeiten, etc."
              rows={3}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
          <Switch 
            id="active-toggle"
            checked={form.values.active} 
            onCheckedChange={v => form.setValues(p => ({ ...p, active: v }))} 
          />
          <label htmlFor="active-toggle" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
            Lieferant ist aktiv
          </label>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Form>
  );
};