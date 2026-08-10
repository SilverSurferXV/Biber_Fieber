import React from 'react';
import { useSendPushNotification } from '../helpers/useAdminApi';
import { schema } from '../endpoints/admin/push-notification/send_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import styles from './AdminPush.module.css';

export const AdminPush = () => {
  const { mutateAsync: sendPush, isPending } = useSendPushNotification();
  
  const form = useForm({
    defaultValues: {
      title: '',
      message: '',
    },
    schema
  });

  const onSubmit = async (data: { title: string; message: string }) => {
    try {
      await sendPush(data);
      toast.success("Benachrichtigung erfolgreich gesendet!");
      form.setValues({ title: '', message: '' });
    } catch(e: unknown) { 
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Ein unbekannter Fehler ist aufgetreten.");
      }
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Push Benachrichtigungen</h2>
      </div>

      <div className={styles.infoBox}>
        <Info size={18} className={styles.infoIcon} />
        <div>
          <strong>Hinweis:</strong> Push-Benachrichtigungen funktionieren nur in der veröffentlichten Version der App, da die OneSignal-Integration auf den produktiven Service-Worker angewiesen ist.
        </div>
      </div>

      <div className={styles.sectionBox}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
            <FormItem name="title">
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input 
                  placeholder="z.B. Neue Bio-Produkte eingetroffen!"
                  value={form.values.title} 
                  onChange={e => form.setValues(p => ({...p, title: e.target.value}))}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="message">
              <FormLabel>Nachricht</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Deine Nachricht an alle Kunden..."
                  value={form.values.message} 
                  onChange={e => form.setValues(p => ({...p, message: e.target.value}))}
                  disabled={isPending}
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.formActions}>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Wird gesendet..." : "Senden"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};