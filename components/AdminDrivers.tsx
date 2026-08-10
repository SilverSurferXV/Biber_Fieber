import React, { useState } from 'react';
import { useAdminDrivers, useSaveAdminDriver, useDeleteAdminDriver } from '../helpers/useAdminDriverApi';
import { useAdminDriverRatings } from '../helpers/useAdminDriverRatings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Button } from './Button';
import { Input } from './Input';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { Checkbox } from './Checkbox';
import { toast } from 'sonner';
import { schema as saveSchema } from '../endpoints/admin/driver/save_POST.schema';
import { OutputType as DriversOutputType } from '../endpoints/admin/drivers_GET.schema';
import styles from './AdminDrivers.module.css';

type Driver = DriversOutputType[number];

const formatCompensation = (value: string | null | undefined): string => {
  if (value == null) return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)} €`;
};

const StarRating = ({ value }: { value: number }) => {
  const fullStars = Math.round(value);
  return (
    <div className={styles.starRating}>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= fullStars ? styles.starFilled : styles.starEmpty}
          />
        ))}
      </div>
      <span className={styles.ratingValue}>{value.toFixed(1)}</span>
    </div>
  );
};

const DriverRatingsTab = () => {
  const { data: ratings, isLoading } = useAdminDriverRatings();

  if (isLoading) {
    return <div>Lade Kundenbewertung...</div>;
  }

  if (!ratings || ratings.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Noch keine Bewertungen vorhanden.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fahrer</th>
            <th>Sauberkeit</th>
            <th>Lärm</th>
            <th>Ablageort</th>
            <th>Bewertungen</th>
            <th>Trinkgeld</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r) => (
            <tr key={r.driverId}>
              <td>{r.driverName}</td>
              <td><StarRating value={r.avgClean} /></td>
              <td><StarRating value={r.avgNoise} /></td>
              <td><StarRating value={r.avgPlacement} /></td>
              <td>{r.totalRatings}</td>
              <td>{r.totalTips.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AdminDrivers = () => {
  const { data: drivers, isFetching } = useAdminDrivers();
  const { data: ratings } = useAdminDriverRatings();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const { mutateAsync: del } = useDeleteAdminDriver();

  const ratingsMap = React.useMemo(() => {
    const map: Record<number, number> = {};
    if (ratings) {
      for (const r of ratings) {
        const score = Math.round(((r.avgClean + r.avgNoise + r.avgPlacement) / 15) * 100);
        map[r.driverId] = score;
      }
    }
    return map;
  }, [ratings]);

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return styles.scoreHigh;
    if (score >= 50) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const handleDelete = async (userId: number) => {
    if (confirm("Fahrer wirklich deaktivieren/löschen?")) {
      try {
        await del({ userId });
        toast.success("Fahrer gelöscht");
      } catch (e: unknown) {
        if (e instanceof Error) toast.error(e.message);
      }
    }
  };

  return (
    <div className={styles.viewContainer}>
      <Tabs defaultValue="list" className={styles.tabsWrapper}>
        <TabsList data-variant="pill" style={{ alignSelf: 'flex-start' }}>
          <TabsTrigger value="list">Fahrerliste</TabsTrigger>
          <TabsTrigger value="ratings">Bewertungen</TabsTrigger>
        </TabsList>

        <TabsContent value="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className={styles.header}>
            <h2>Fahrer</h2>
            <Button onClick={() => setCreateOpen(true)}>Fahrer anlegen</Button>
          </div>

          {isFetching ? (
            <div>Lade Fahrer...</div>
          ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobilnummer</th>
                <th>Kundenbewertung</th>
                <th>Verpackungsverg.</th>
                <th>Stopvergütung</th>
                <th>Status</th>
                <th>Registriert am</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(drivers || []).map((d) => {
                const score = ratingsMap[d.id];
                return (
                <tr key={d.id}>
                  <td>{d.firstName} {d.lastName}</td>
                  <td>{d.email}</td>
                  <td>{d.mobileNumber || '-'}</td>
                  <td>
                    {score !== undefined ? (
                      <span className={`${styles.scoreBadge} ${getScoreColorClass(score)}`}>
                        {score} / 100
                      </span>
                    ) : '-'}
                  </td>
                  <td>{formatCompensation(d.packagingCompensation)}</td>
                  <td>{formatCompensation(d.stopCompensation)}</td>
                  <td>{d.active ? 'Aktiv' : 'Inaktiv'}</td>
                  <td>{d.createdAt ? new Intl.DateTimeFormat('de-DE').format(new Date(d.createdAt as string | number | Date)) : '-'}</td>
                  <td>
                    <div className={styles.actions}>
                      <Button size="sm" variant="outline" onClick={() => setEditDriver(d)}>Bearbeiten</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(d.id)}>Löschen</Button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {drivers?.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center' }}>Keine Fahrer gefunden</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          )}
        </TabsContent>

        <TabsContent value="ratings" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className={styles.header}>
            <h2>Fahrer Bewertungen</h2>
          </div>
          <DriverRatingsTab />
        </TabsContent>
      </Tabs>

      {(createOpen || editDriver) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditDriver(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editDriver ? 'Fahrer bearbeiten' : 'Fahrer anlegen'}</DialogTitle>
            </DialogHeader>
            <DriverCreateEditForm
              driver={editDriver ?? undefined}
              onClose={() => {
                setCreateOpen(false);
                setEditDriver(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const DriverCreateEditForm = ({ driver, onClose }: { driver?: Driver; onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminDriver();

  const parseNullableNumeric = (value: string | null | undefined): number | undefined => {
    if (value == null) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  const form = useForm({
    defaultValues: {
      id: driver?.id,
      firstName: driver?.firstName || '',
      lastName: driver?.lastName || '',
      email: driver?.email || '',
      password: undefined as string | undefined,
      mobileNumber: driver?.mobileNumber || undefined,
      billingCompanyName: driver?.billingCompanyName || undefined,
      billingStreet: driver?.billingStreet || undefined,
      billingCity: driver?.billingCity || undefined,
      billingPostcode: driver?.billingPostcode || undefined,
      billingCountry: driver?.billingCountry || 'Deutschland',
      billingTaxNumber: driver?.billingTaxNumber || undefined,
      packagingCompensation: parseNullableNumeric(driver?.packagingCompensation),
      stopCompensation: parseNullableNumeric(driver?.stopCompensation),
      invoiceCompanyName: driver?.invoiceCompanyName || undefined,
      invoiceStreet: driver?.invoiceStreet || undefined,
      invoiceHouseNumber: driver?.invoiceHouseNumber || undefined,
      invoicePostcode: driver?.invoicePostcode || undefined,
      invoiceCity: driver?.invoiceCity || undefined,
      invoiceTaxId: driver?.invoiceTaxId || undefined,
      invoiceTaxNumber: driver?.invoiceTaxNumber || undefined,
      vatEligible: driver?.vatEligible ?? false,
      iban: driver?.iban || undefined,
    },
    schema: saveSchema,
  });

  const onSubmit = async (data: typeof form.values) => {
    try {
      const payload = { ...data };
      // Strip empty optional string fields
      if (!payload.password) delete payload.password;
      if (!payload.mobileNumber) delete payload.mobileNumber;
      if (!payload.billingCompanyName) delete payload.billingCompanyName;
      if (!payload.billingStreet) delete payload.billingStreet;
      if (!payload.billingCity) delete payload.billingCity;
      if (!payload.billingPostcode) delete payload.billingPostcode;
      if (!payload.billingCountry) delete payload.billingCountry;
      if (!payload.billingTaxNumber) delete payload.billingTaxNumber;
      if (!payload.invoiceCompanyName) delete payload.invoiceCompanyName;
      if (!payload.invoiceStreet) delete payload.invoiceStreet;
      if (!payload.invoiceHouseNumber) delete payload.invoiceHouseNumber;
      if (!payload.invoicePostcode) delete payload.invoicePostcode;
      if (!payload.invoiceCity) delete payload.invoiceCity;
      if (!payload.invoiceTaxId) delete payload.invoiceTaxId;
      if (!payload.invoiceTaxNumber) delete payload.invoiceTaxNumber;
      if (!payload.iban) delete payload.iban;

      await save(payload);
      toast.success(driver ? "Fahrer aktualisiert" : "Fahrer angelegt");
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className={styles.formGrid}>
          <FormItem name="firstName">
            <FormLabel>Vorname</FormLabel>
            <FormControl>
              <Input
                value={form.values.firstName || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, firstName: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="lastName">
            <FormLabel>Nachname</FormLabel>
            <FormControl>
              <Input
                value={form.values.lastName || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, lastName: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="email">
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                value={form.values.email || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, email: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="mobileNumber">
            <FormLabel>Mobilnummer</FormLabel>
            <FormControl>
              <Input
                value={form.values.mobileNumber || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, mobileNumber: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="password">
            <FormLabel>{driver ? 'Neues Passwort (optional)' : 'Passwort'}</FormLabel>
            <FormControl>
              <Input
                type="password"
                value={form.values.password || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, password: e.target.value || undefined }))}
                placeholder={driver ? "Leer lassen um beizubehalten" : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.sectionHeader}>
          <h4>WOHNANSCHRIFT</h4>
        </div>

        <div className={styles.formGrid}>
                    <FormItem name="billingCompanyName">
            <FormLabel>Geburtsdatum</FormLabel>
            <FormControl>
              <Input
                value={form.values.billingCompanyName || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, billingCompanyName: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="billingStreet">
            <FormLabel>Straße</FormLabel>
            <FormControl>
              <Input
                value={form.values.billingStreet || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, billingStreet: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="billingPostcode">
            <FormLabel>PLZ</FormLabel>
            <FormControl>
              <Input
                value={form.values.billingPostcode || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, billingPostcode: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="billingCity">
            <FormLabel>Stadt</FormLabel>
            <FormControl>
              <Input
                value={form.values.billingCity || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, billingCity: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="billingCountry">
            <FormLabel>Land</FormLabel>
            <FormControl>
              <Input
                value={form.values.billingCountry || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, billingCountry: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          
        </div>

        <div className={styles.sectionHeader}>
          <h4>RECHNUNGSANSCHRIFT</h4>
        </div>

        <div className={styles.formGrid}>
          <FormItem name="invoiceCompanyName">
            <FormLabel>Firmenname</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceCompanyName || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceCompanyName: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoiceStreet">
            <FormLabel>Straße</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceStreet || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceStreet: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoiceHouseNumber">
            <FormLabel>Hausnummer</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceHouseNumber || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceHouseNumber: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoicePostcode">
            <FormLabel>PLZ</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoicePostcode || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoicePostcode: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoiceCity">
            <FormLabel>Ort</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceCity || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceCity: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoiceTaxId">
            <FormLabel>UST ID</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceTaxId || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceTaxId: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="invoiceTaxNumber">
            <FormLabel>Steuernummer</FormLabel>
            <FormControl>
              <Input
                value={form.values.invoiceTaxNumber || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, invoiceTaxNumber: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="iban">
            <FormLabel>IBAN</FormLabel>
            <FormControl>
              <Input
                value={form.values.iban || ''}
                onChange={(e) => form.setValues((p) => ({ ...p, iban: e.target.value || undefined }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--spacing-4)' }}>
          <Checkbox 
            id="vatEligible"
            checked={form.values.vatEligible} 
            onChange={(e) => form.setValues(p => ({...p, vatEligible: e.target.checked}))} 
          />
          <label htmlFor="vatEligible" style={{ fontSize: '0.875rem' }}>Umsatzsteuer Berechtigt?</label>
        </div>

        <div className={styles.sectionHeader}>
          <h4>Vergütung</h4>
        </div>

        <div className={styles.formGrid}>
          <FormItem name="packagingCompensation">
            <FormLabel>Verpackungsvergütung</FormLabel>
            <div className={styles.inputWithSuffix}>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.values.packagingCompensation ?? ''}
                  onChange={(e) => form.setValues((p) => ({
                    ...p,
                    packagingCompensation: e.target.value === '' ? undefined : parseFloat(e.target.value),
                  }))}
                  className={styles.inputWithSuffixInput}
                />
              </FormControl>
              <span className={styles.inputSuffix}>€</span>
            </div>
            <FormMessage />
          </FormItem>

          <FormItem name="stopCompensation">
            <FormLabel>Stopvergütung</FormLabel>
            <div className={styles.inputWithSuffix}>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.values.stopCompensation ?? ''}
                  onChange={(e) => form.setValues((p) => ({
                    ...p,
                    stopCompensation: e.target.value === '' ? undefined : parseFloat(e.target.value),
                  }))}
                  className={styles.inputWithSuffixInput}
                />
              </FormControl>
              <span className={styles.inputSuffix}>€</span>
            </div>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
        </div>
      </form>
    </Form>
  );
};