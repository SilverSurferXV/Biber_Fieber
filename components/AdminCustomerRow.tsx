import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { 
  useUpdateAdminCustomer, 
  useDeleteAdminCustomer, 
  useAdjustCustomerPoints 
} from '../helpers/useAdminApi';
import { useAdminCustomerOrders } from '../helpers/useAdminCustomerOrders';
import { useAdminCustomerTransactions } from '../helpers/useAdminCustomerTransactions';
import { Button } from './Button';
import { Input } from './Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { toast } from 'sonner';
import { schema as updateSchema } from '../endpoints/admin/customer/update_POST.schema';
import { schema as adjustSchema } from '../endpoints/admin/point-adjustment_POST.schema';
import styles from './AdminCustomerRow.module.css';

export const AdminCustomerRow = ({ customer, showCompanyName }: { customer: any; showCompanyName?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [showDropoffPhoto, setShowDropoffPhoto] = useState(false);
  const { mutateAsync: del } = useDeleteAdminCustomer();

  const handleDelete = async () => {
    if (confirm("Kunde wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) {
      try {
        await del({ userId: customer.id });
        toast.success("Kunde gelöscht");
      } catch (e: any) {
        if (e instanceof Error) toast.error(e.message);
      }
    }
  };

  return (
    <>
      <tr className={expanded ? styles.expandedRow : ''}>
        <td>{customer.lastName}, {customer.firstName}</td>
        {showCompanyName && <td>{customer.companyName || '-'}</td>}
        <td>{customer.salutation || '-'}</td>
        <td>{customer.postcode}</td>
        <td>{customer.email}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            {customer.pointsBalance ?? 0}
            <Button size="icon-sm" variant="outline" onClick={() => setAdjustOpen(true)}>+</Button>
          </div>
        </td>
        <td>{customer.bibercode}</td>
        <td>
          <Button size="sm" variant="outline" onClick={() => { setExpanded(!expanded); setEditing(false); }}>
            {expanded ? "Schließen" : "Details"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={showCompanyName ? 8 : 7} className={styles.detailsCell}>
            <div className={styles.detailsContainer}>
              {editing ? (
                <CustomerEditForm customer={customer} onCancel={() => setEditing(false)} />
              ) : (
                <div className={styles.detailsView}>
                  <div className={styles.detailsGrid}>
                    {showCompanyName && <div><strong>Firmenname:</strong> {customer.companyName || '-'}</div>}
                    <div><strong>Anrede:</strong> {customer.salutation || '-'}</div>
                    <div><strong>Vorname:</strong> {customer.firstName}</div>
                    <div><strong>Nachname:</strong> {customer.lastName}</div>
                    <div><strong>Email:</strong> {customer.email}</div>
                    <div><strong>Straße:</strong> {customer.streetAddress}</div>
                    <div><strong>Stadt:</strong> {customer.city}</div>
                    <div><strong>PLZ:</strong> {customer.postcode}</div>
                    <div><strong>Mobil:</strong> {customer.mobileNumber}</div>
                    <div><strong>Geburtsdatum:</strong> {customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('de-DE') : '-'}</div>
                    <div><strong>Sprache:</strong> {customer.languagePreference}</div>
                    <div><strong>Benachrichtigung:</strong> {customer.notificationPreference}</div>
                    <div><strong>Bibercode:</strong> {customer.bibercode}</div>
                    <div><strong>Empfohlen von:</strong> {customer.referredByBibercode}</div>
                    <div><strong>Guthaben:</strong> {customer.pointsBalance}</div>
                    <div><strong>Registriert:</strong> {new Date(customer.createdAt).toLocaleDateString()}</div>
                    <div><strong>Aktiv:</strong> {customer.active ? "Ja" : "Nein"}</div>
                  </div>
                  <div className={styles.dropoffSection}>
                    <h4>Abstellbeschreibung:</h4>
                    <p>{customer.dropoffDescription || '-'}</p>
                    {customer.dropoffPhotoUrl && (
                      <>
                        <img 
                          src={customer.dropoffPhotoUrl} 
                          alt="Abstellort Thumbnail" 
                          loading="lazy"
                          className={styles.dropoffThumbnail} 
                          onClick={() => setShowDropoffPhoto(true)}
                        />
                        {showDropoffPhoto && (
                          <Dialog open={true} onOpenChange={setShowDropoffPhoto}>
                            <DialogContent className={styles.photoDialogContent}>
                              <img src={customer.dropoffPhotoUrl} alt="Abstellort groß" loading="lazy" className={styles.fullPhoto} />
                            </DialogContent>
                          </Dialog>
                        )}
                      </>
                    )}
                  </div>
                  <CustomerTransactions customerId={customer.id} />
                  <CustomerOrders customerId={customer.id} />
                  <div className={styles.actions}>
                    <Button onClick={() => setEditing(true)}>Bearbeiten</Button>
                    <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
      {adjustOpen && (
        <Dialog open={true} onOpenChange={setAdjustOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Guthaben anpassen</DialogTitle></DialogHeader>
            <AdjustPointsForm customer={customer} onClose={() => setAdjustOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

const CustomerEditForm = ({ customer, onCancel }: { customer: any, onCancel: () => void }) => {
  const { mutateAsync: update } = useUpdateAdminCustomer();
  const formattedDob = customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split('T')[0] : '';
  
  const form = useForm({
    defaultValues: {
      userId: customer.id,
      salutation: customer.salutation || '',
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      streetAddress: customer.streetAddress,
      city: customer.city,
      postcode: customer.postcode,
      mobileNumber: customer.mobileNumber,
      dateOfBirth: formattedDob,
      notificationPreference: customer.notificationPreference || 'email',
      languagePreference: customer.languagePreference || 'de',
      pointsBalance: customer.pointsBalance != null ? Number(customer.pointsBalance) : null
    },
    schema: updateSchema
  });

  const onSubmit = async (data: any) => {
    try {
      await update(data);
      toast.success("Kunde aktualisiert");
      onCancel();
    } catch (e: any) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className={styles.formGrid}>
          <FormItem name="salutation">
            <FormLabel>Anrede</FormLabel>
            <FormControl>
              <Select
                value={form.values.salutation || "__empty"}
                onValueChange={v => form.setValues(p => ({...p, salutation: v === "__empty" ? null : v as any}))}
              >
                <SelectTrigger><SelectValue placeholder="Anrede wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">Keine</SelectItem>
                  <SelectItem value="Herr">Herr</SelectItem>
                  <SelectItem value="Frau">Frau</SelectItem>
                  <SelectItem value="Herr Dr.">Herr Dr.</SelectItem>
                  <SelectItem value="Frau Dr.">Frau Dr.</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="firstName">
            <FormLabel>Vorname</FormLabel>
            <FormControl><Input value={form.values.firstName || ''} onChange={e => form.setValues(p => ({...p, firstName: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="lastName">
            <FormLabel>Nachname</FormLabel>
            <FormControl><Input value={form.values.lastName || ''} onChange={e => form.setValues(p => ({...p, lastName: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="email">
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" value={form.values.email} onChange={e => form.setValues(p => ({...p, email: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="streetAddress">
            <FormLabel>Straße</FormLabel>
            <FormControl><Input value={form.values.streetAddress || ''} onChange={e => form.setValues(p => ({...p, streetAddress: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="city">
            <FormLabel>Stadt</FormLabel>
            <FormControl><Input value={form.values.city || ''} onChange={e => form.setValues(p => ({...p, city: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="postcode">
            <FormLabel>PLZ</FormLabel>
            <FormControl><Input value={form.values.postcode || ''} onChange={e => form.setValues(p => ({...p, postcode: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="mobileNumber">
            <FormLabel>Mobilnummer</FormLabel>
            <FormControl><Input value={form.values.mobileNumber || ''} onChange={e => form.setValues(p => ({...p, mobileNumber: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="dateOfBirth">
            <FormLabel>Geburtsdatum</FormLabel>
            <FormControl><Input type="date" value={form.values.dateOfBirth || ''} onChange={e => form.setValues(p => ({...p, dateOfBirth: e.target.value || null}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="languagePreference">
            <FormLabel>Sprache</FormLabel>
            <FormControl>
              <Select 
                value={form.values.languagePreference || "_empty"}
                onValueChange={v => form.setValues(p => ({...p, languagePreference: v === "_empty" ? null : v as any}))}
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
          
          <FormItem name="notificationPreference">
            <FormLabel>Benachrichtigung</FormLabel>
            <FormControl>
              <Select 
                value={form.values.notificationPreference || "_empty"}
                onValueChange={v => form.setValues(p => ({...p, notificationPreference: v === "_empty" ? null : v as any}))}
              >
                <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">Keine</SelectItem>
                  <SelectItem value="both">Beide</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="pointsBalance">
            <FormLabel>Guthaben</FormLabel>
            <FormControl><Input type="number" step="0.01" value={form.values.pointsBalance ?? ''} onChange={e => form.setValues(p => ({...p, pointsBalance: e.target.value === '' ? null : parseFloat(e.target.value)}))}/></FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name="newPassword">
            <FormLabel>Neues Passwort</FormLabel>
            <FormControl><Input type="text" value={form.values.newPassword || ''} placeholder="Leer lassen um unverändert" onChange={e => form.setValues(p => ({...p, newPassword: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        </div>
      </form>
    </Form>
  )
};

const AdjustPointsForm = ({ customer, onClose }: { customer: any, onClose: () => void }) => {
  const { mutateAsync: adjust } = useAdjustCustomerPoints();
  const form = useForm({
    defaultValues: {
      customerId: customer.id,
      amount: 0,
      note: ''
    },
    schema: adjustSchema
  });

  const onSubmit = async (data: any) => {
    try {
      await adjust(data);
      toast.success("Guthaben angepasst");
      onClose();
    } catch (e: any) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormItem name="amount">
          <FormLabel>Betrag (+/-)</FormLabel>
          <FormControl><Input type="number" step="0.01" value={form.values.amount ?? ''} onChange={e => form.setValues(p => ({...p, amount: parseFloat(e.target.value) || 0}))} /></FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="note">
          <FormLabel>Notiz / Grund</FormLabel>
          <FormControl><Input value={form.values.note} onChange={e => form.setValues(p => ({...p, note: e.target.value}))} /></FormControl>
          <FormMessage />
        </FormItem>
        <div className={styles.formActions}>
          <Button type="submit">Anpassen</Button>
        </div>
      </form>
    </Form>
  );
};

const CustomerTransactions = ({ customerId }: { customerId: number }) => {
  const [open, setOpen] = useState(false);
  const { data: transactions, isLoading } = useAdminCustomerTransactions(customerId);

  if (isLoading) return <div style={{ marginBottom: "var(--spacing-4)" }}>Lade Transaktionen...</div>;

  const translateType = (type: string) => {
    switch (type) {
      case "admin_adjustment": return "Admin-Anpassung";
      case "topup": return "Aufladung";
      case "order_payment": return "Bestellung";
      case "bibercode_credit": return "Bibercode-Gutschrift";
      default: return type;
    }
  };

  return (
    <div className={styles.transactionsSection}>
      <h3 className={styles.collapsibleHeader} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Aufladungen & Anpassungen
      </h3>
      {open && (
        !transactions || transactions.length === 0 ? (
          <div>Keine Einträge</div>
        ) : (
          <table className={styles.transactionsTable}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Typ</th>
                <th>Betrag</th>
                <th>Grund</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t.createdAt as any))}</td>
                  <td>{translateType(t.type)}</td>
                  <td className={t.amount > 0 ? styles.amountPositive : t.amount < 0 ? styles.amountNegative : ''}>
                    {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                  </td>
                  <td>{t.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
};

const CustomerOrders = ({ customerId }: { customerId: number }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useAdminCustomerOrders(customerId);

  if (isLoading) return <div style={{ marginBottom: "var(--spacing-4)" }}>Lade Bestellungen...</div>;

  const orders = data?.orders || [];

  return (
    <div className={styles.transactionsSection}>
      <h3 className={styles.collapsibleHeader} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Bestellhistorie
      </h3>
      {open && (
        orders.length === 0 ? (
          <div>Keine Bestellungen</div>
        ) : (
          <table className={styles.transactionsTable}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Bestellnummer</th>
                <th>Betrag (€)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.orderDate ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(o.orderDate)) : '-'}</td>
                  <td>{o.orderNumber}</td>
                  <td>{o.total !== null ? o.total.toFixed(2) : '-'}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
};