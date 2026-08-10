import React, { useState } from 'react';
import { useAdminAdminsQuery, useAdminAdminRoleMutation } from '../helpers/useAdminAdmins';
import { Button } from './Button';
import { Input } from './Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { toast } from 'sonner';
import { schema as roleSchema } from '../endpoints/admin/admin/role_POST.schema';
import styles from './AdminAdministrators.module.css';

export const AdminAdministrators = () => {
  const { data: admins, isFetching } = useAdminAdminsQuery();
  const { mutateAsync: updateRole } = useAdminAdminRoleMutation();
  const [createOpen, setCreateOpen] = useState(false);

  const handleDemote = async (email: string) => {
    if (confirm("Administrator wirklich die Rechte entziehen und zum normalen Benutzer herabstufen?")) {
      try {
        await updateRole({ email, role: 'user' });
        toast.success("Administrator erfolgreich herabgestuft");
      } catch (e: unknown) {
        if (e instanceof Error) toast.error(e.message);
      }
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Administratoren</h2>
        <Button onClick={() => setCreateOpen(true)}>Administrator hinzufügen</Button>
      </div>

      {isFetching ? (
        <div>Lade Administratoren...</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobilnummer</th>
                <th>Registriert am</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(admins || []).map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.firstName || admin.lastName ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() : '-'}</td>
                  <td>{admin.email}</td>
                  <td>{admin.mobileNumber || '-'}</td>
                  <td>
                    {admin.createdAt
                      ? new Intl.DateTimeFormat('de-DE').format(new Date(admin.createdAt as string | number | Date))
                      : '-'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleDemote(admin.email)}
                      >
                        Entfernen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {admins?.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>Keine Administratoren gefunden</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Administrator hinzufügen</DialogTitle>
            </DialogHeader>
            <AddAdministratorForm
              onClose={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const AddAdministratorForm = ({ onClose }: { onClose: () => void }) => {
  const { mutateAsync: updateRole } = useAdminAdminRoleMutation();

  const form = useForm({
    defaultValues: {
      email: '',
      role: 'admin' as const,
    },
    schema: roleSchema,
  });

  const onSubmit = async (data: typeof form.values) => {
    try {
      await updateRole(data);
      toast.success("Administrator erfolgreich hinzugefügt");
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className={styles.formGrid}>
          <FormItem name="email">
            <FormLabel>Email des existierenden Benutzers</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="benutzer@beispiel.de"
                value={form.values.email}
                onChange={(e) => form.setValues((p) => ({ ...p, email: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formActions}>
          <Button type="submit">Hinzufügen</Button>
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
        </div>
      </form>
    </Form>
  );
};