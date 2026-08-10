import React from 'react';
import { z } from 'zod';
import { useAdminCustomerCreate } from '../helpers/useAdminCustomerCreate';
import { Button } from './Button';
import { Input } from './Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { toast } from 'sonner';
import { schema as createSchema } from '../endpoints/admin/customer/create_POST.schema';
import styles from './AdminBusinessCustomerCreateForm.module.css';

const businessSchema = createSchema.extend({
  companyName: z.string().min(1, "Firmenname ist erforderlich"),
});

type BusinessFormData = z.infer<typeof businessSchema>;

export const AdminBusinessCustomerCreateForm = ({ onClose }: { onClose: () => void }) => {
  const { mutateAsync: create } = useAdminCustomerCreate();
  
  const form = useForm({
    defaultValues: {
      companyName: '',
      salutation: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      streetAddress: '',
      city: '',
      postcode: '',
      mobileNumber: '',
      dateOfBirth: '',
      referralCode: '',
      languagePreference: 'de',
      notificationPreference: 'both'
    },
    schema: businessSchema
  });

  const onSubmit = async (data: BusinessFormData) => {
    try {
      await create(data);
      toast.success("Firmenkunde angelegt");
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className={styles.formGrid}>
          <FormItem name="companyName">
            <FormLabel>Firmenname</FormLabel>
            <FormControl><Input value={form.values.companyName || ''} onChange={e => form.setValues(p => ({...p, companyName: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="salutation">
            <FormLabel>Anrede</FormLabel>
            <FormControl>
              <Select 
                value={form.values.salutation || "_empty"}
                onValueChange={v => form.setValues(p => ({...p, salutation: v === "_empty" ? undefined : v}))}
              >
                <SelectTrigger><SelectValue placeholder="Anrede wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">Keine</SelectItem>
                  <SelectItem value="Herr">Herr</SelectItem>
                  <SelectItem value="Frau">Frau</SelectItem>
                  <SelectItem value="Firma">Firma</SelectItem>
                  <SelectItem value="Divers">Divers</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="firstName">
            <FormLabel>Vorname</FormLabel>
            <FormControl><Input value={form.values.firstName || ''} onChange={e => form.setValues(p => ({...p, firstName: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="lastName">
            <FormLabel>Nachname</FormLabel>
            <FormControl><Input value={form.values.lastName || ''} onChange={e => form.setValues(p => ({...p, lastName: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="email">
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" value={form.values.email || ''} onChange={e => form.setValues(p => ({...p, email: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="password">
            <FormLabel>Passwort</FormLabel>
            <FormControl><Input type="password" value={form.values.password || ''} onChange={e => form.setValues(p => ({...p, password: e.target.value}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="streetAddress">
            <FormLabel>Straße</FormLabel>
            <FormControl><Input value={form.values.streetAddress || ''} onChange={e => form.setValues(p => ({...p, streetAddress: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="city">
            <FormLabel>Stadt</FormLabel>
            <FormControl><Input value={form.values.city || ''} onChange={e => form.setValues(p => ({...p, city: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="postcode">
            <FormLabel>PLZ</FormLabel>
            <FormControl><Input value={form.values.postcode || ''} onChange={e => form.setValues(p => ({...p, postcode: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="mobileNumber">
            <FormLabel>Mobilnummer</FormLabel>
            <FormControl><Input value={form.values.mobileNumber || ''} onChange={e => form.setValues(p => ({...p, mobileNumber: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="dateOfBirth">
            <FormLabel>Geburtsdatum</FormLabel>
            <FormControl><Input type="date" value={form.values.dateOfBirth || ''} onChange={e => form.setValues(p => ({...p, dateOfBirth: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="referralCode">
            <FormLabel>Empfehlungscode</FormLabel>
            <FormControl><Input value={form.values.referralCode || ''} onChange={e => form.setValues(p => ({...p, referralCode: e.target.value || undefined}))}/></FormControl>
            <FormMessage />
          </FormItem>
          
          <FormItem name="languagePreference">
            <FormLabel>Sprache</FormLabel>
            <FormControl>
              <Select 
                value={form.values.languagePreference || "_empty"}
                onValueChange={v => form.setValues(p => ({...p, languagePreference: v === "_empty" ? undefined : v as any}))}
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
                onValueChange={v => form.setValues(p => ({...p, notificationPreference: v === "_empty" ? undefined : v as any}))}
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
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Anlegen</Button>
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
        </div>
      </form>
    </Form>
  )
};