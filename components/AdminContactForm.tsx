import React from 'react';
import { useAdminContactSettings, useSaveAdminContactSettings } from '../helpers/useAdminContactSettings';
import { schema as saveSchema } from '../endpoints/admin/contact-settings/save_POST.schema';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { Input } from './Input';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { toast } from 'sonner';
import { AdminMicrosoftEmailSection } from './AdminMicrosoftEmailSection';
import styles from './AdminContactForm.module.css';

const ContactSettingsForm = ({ settings }: { settings: any }) => {
  const { mutateAsync: save } = useSaveAdminContactSettings();
  
  const form = useForm({
    defaultValues: {
      contactFromEmail: settings.contactFromEmail ?? '',
      contactFromName: settings.contactFromName ?? '',
      contactToEmail: settings.contactToEmail ?? '',
      contactToName: settings.contactToName ?? '',
    },
    schema: saveSchema
  });

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Kontaktformular Einstellungen gespeichert!");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Speichern");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <div className={styles.sectionBox}>
          <h3>Absender (System-E-Mails)</h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <FormItem name="contactFromName" style={{ flex: 1 }}>
              <FormLabel>Absender Name</FormLabel>
              <FormControl>
                <Input 
                  value={form.values.contactFromName} 
                  onChange={e => form.setValues(p => ({...p, contactFromName: e.target.value}))}
                  placeholder="z.B. Biber Fieber Team"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            
            <FormItem name="contactFromEmail" style={{ flex: 1 }}>
              <FormLabel>Absender E-Mail</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  value={form.values.contactFromEmail} 
                  onChange={e => form.setValues(p => ({...p, contactFromEmail: e.target.value}))}
                  placeholder="z.B. noreply@biber-fieber.de"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>
        </div>

        <div className={styles.sectionBox}>
          <h3>Empfänger (Eingehende Nachrichten)</h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <FormItem name="contactToName" style={{ flex: 1 }}>
              <FormLabel>Empfänger Name</FormLabel>
              <FormControl>
                <Input 
                  value={form.values.contactToName} 
                  onChange={e => form.setValues(p => ({...p, contactToName: e.target.value}))}
                  placeholder="z.B. Support Team"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            
            <FormItem name="contactToEmail" style={{ flex: 1 }}>
              <FormLabel>Empfänger E-Mail</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  value={form.values.contactToEmail} 
                  onChange={e => form.setValues(p => ({...p, contactToEmail: e.target.value}))}
                  placeholder="z.B. kontakt@biber-fieber.de"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Form>
  );
};

export const AdminContactForm = () => {
  const { data: settings, isLoading } = useAdminContactSettings();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Kontakt & E-Mail Einstellungen</h2>
      </div>
      <p style={{ margin: 0, color: 'var(--muted-foreground)' }}>
        Hier können Absender und Empfänger des Kontaktformulars sowie die Microsoft E-Mail Integration konfiguriert werden.
      </p>

      <AdminMicrosoftEmailSection />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Skeleton style={{ height: '200px' }} />
          <Skeleton style={{ height: '200px' }} />
        </div>
      ) : settings ? (
        <ContactSettingsForm settings={settings} />
      ) : (
        <p style={{ color: 'var(--error)' }}>Fehler beim Laden der Einstellungen.</p>
      )}
    </div>
  );
};