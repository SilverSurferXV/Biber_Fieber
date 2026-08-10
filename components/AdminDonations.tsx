import React, { useState, useRef } from "react";
import { useAdminCharityOrganizations, useSaveCharityOrganization, useDeleteCharityOrganization, CharityOrganization } from "../helpers/useAdminDonationApi";
import { useAdminCharityUploadLogo } from "../helpers/useAdminCharityUploadLogo";
import { schema as saveSchema } from "../endpoints/admin/charity-organization/save_POST.schema";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { toast } from "sonner";
import { Edit2, Trash2, Upload, X } from "lucide-react";
import * as z from "zod";
import styles from "./AdminDonations.module.css";

export const AdminDonations = () => {
  const { data: organizations } = useAdminCharityOrganizations();
  const [editingId, setEditing] = useState<number | null | "new">(null);

  const activeOrg = editingId === "new" ? undefined : organizations?.find(o => o.id === editingId);
  const { mutateAsync: deleteOrg } = useDeleteCharityOrganization();

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm("Möchten Sie diese Organisation wirklich löschen?")) {
      try {
        await deleteOrg({ id });
        toast.success("Organisation erfolgreich gelöscht.");
      } catch (err: unknown) {
        if (err instanceof Error) {
          toast.error(err.message);
        } else {
          toast.error("Fehler beim Löschen der Organisation.");
        }
      }
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Biber Smile Organisationen</h2>
        <Button onClick={() => setEditing("new")}>Neue Organisation</Button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Logo</th>
              <th>Name</th>
              <th>Anschrift</th>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Kontaktperson</th>
              <th>Telefon</th>
              <th>E-Mail</th>
              <th>Registernummer</th>
              <th className={styles.numberCell}>Gesammelte Punkte</th>
              <th>Status</th>
              <th className={styles.actionCell}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {organizations?.map(org => (
              <tr key={org.id} onClick={() => setEditing(org.id)} className={styles.clickableRow}>
                <td>
                  {org.logoUrl ? (
                    <img src={org.logoUrl} alt={org.name} className={styles.logoThumbnail} />
                  ) : (
                    <span className={styles.mutedDash}>—</span>
                  )}
                </td>
                <td><strong>{org.name}</strong></td>
                <td className={styles.descCell}>{org.streetAddress || "—"}</td>
                <td>{org.postcode || "—"}</td>
                <td>{org.city || "—"}</td>
                <td>{org.contactPerson || "—"}</td>
                <td>{org.phone || "—"}</td>
                <td>{org.email || "—"}</td>
                <td>{org.registerNumber || "—"}</td>
                <td className={styles.numberCell}>
                  {Number(org.totalPointsEarned || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>
                  <span className={`${styles.badge} ${org.active ? styles.badgeActive : styles.badgeInactive}`}>
                    {org.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className={styles.actionCell}>
                  <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setEditing(org.id); }}>
                    <Edit2 size={16} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className={styles.deleteBtn} onClick={(e) => handleDelete(e, org.id)}>
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
            {organizations?.length === 0 && (
              <tr>
                <td colSpan={12} className={styles.emptyState}>Keine Organisationen gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent className={styles.dialogContent}>
            <DialogHeader>
              <DialogTitle>{editingId === "new" ? "Neue Organisation" : "Organisation bearbeiten"}</DialogTitle>
            </DialogHeader>
            <AdminDonationForm org={activeOrg} onClose={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

interface AdminDonationFormProps {
  org: CharityOrganization | undefined;
  onClose: () => void;
}

const AdminDonationForm = ({ org, onClose }: AdminDonationFormProps) => {
  const { mutateAsync: saveOrg } = useSaveCharityOrganization();
  const uploadLogoMutation = useAdminCharityUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: {
      id: org?.id,
      name: org?.name || "",
      description: org?.description || "",
      active: org?.active ?? true,
      streetAddress: org?.streetAddress || "",
      postcode: org?.postcode || "",
      city: org?.city || "",
      bankDetails: org?.bankDetails || "",
      contactPerson: org?.contactPerson || "",
      phone: org?.phone || "",
      email: org?.email || "",
      registerNumber: org?.registerNumber || "",
      logoUrl: org?.logoUrl || "",
    },
    schema: saveSchema
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { url, presignedUrl } = await uploadLogoMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        throw new Error("Fehler beim Hochladen des Logos.");
      }

      form.setValues(prev => ({ ...prev, logoUrl: url }));
      toast.success("Logo erfolgreich hochgeladen!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Fehler beim Hochladen des Logos.");
      }
    }

    // Reset file input so re-selecting the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: z.infer<typeof saveSchema>) => {
    try {
      await saveOrg({
        ...data,
        description: data.description || null,
        streetAddress: data.streetAddress || null,
        postcode: data.postcode || null,
        city: data.city || null,
        bankDetails: data.bankDetails || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        registerNumber: data.registerNumber || null,
        logoUrl: data.logoUrl || null,
      });
      toast.success("Organisation erfolgreich gespeichert!");
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Fehler beim Speichern der Organisation.");
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
        <div className={styles.logoUploadRow}>
          {form.values.logoUrl ? (
            <div className={styles.logoPreviewContainer}>
              <img src={form.values.logoUrl} alt="Logo Vorschau" className={styles.logoPreview} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={styles.logoRemoveBtn}
                onClick={() => form.setValues(prev => ({ ...prev, logoUrl: "" }))}
                aria-label="Logo entfernen"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div className={styles.logoPreviewPlaceholder}>Kein Logo</div>
          )}
          <div className={styles.logoUploadActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className={styles.hiddenFileInput}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLogoMutation.isPending}
            >
              <Upload size={14} />
              {uploadLogoMutation.isPending ? "Hochladen…" : "Logo hochladen"}
            </Button>
          </div>
        </div>

        <FormItem name="name">
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input
              value={form.values.name}
              onChange={e => form.setValues(p => ({ ...p, name: e.target.value }))}
              placeholder="Name des Vereins"
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="description">
          <FormLabel>Beschreibung (Optional)</FormLabel>
          <FormControl>
            <Textarea
              value={form.values.description || ""}
              onChange={e => form.setValues(p => ({ ...p, description: e.target.value }))}
              placeholder="Kurze Beschreibung der Organisation"
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.formTwoCol}>
          <FormItem name="streetAddress">
            <FormLabel>Anschrift</FormLabel>
            <FormControl>
              <Input
                value={form.values.streetAddress || ""}
                onChange={e => form.setValues(p => ({ ...p, streetAddress: e.target.value }))}
                placeholder="Straße und Hausnummer"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="postcode">
            <FormLabel>PLZ</FormLabel>
            <FormControl>
              <Input
                value={form.values.postcode || ""}
                onChange={e => form.setValues(p => ({ ...p, postcode: e.target.value }))}
                placeholder="Postleitzahl"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formTwoCol}>
          <FormItem name="city">
            <FormLabel>Stadt</FormLabel>
            <FormControl>
              <Input
                value={form.values.city || ""}
                onChange={e => form.setValues(p => ({ ...p, city: e.target.value }))}
                placeholder="Stadt"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="contactPerson">
            <FormLabel>Kontaktperson</FormLabel>
            <FormControl>
              <Input
                value={form.values.contactPerson || ""}
                onChange={e => form.setValues(p => ({ ...p, contactPerson: e.target.value }))}
                placeholder="Name der Kontaktperson"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formTwoCol}>
          <FormItem name="phone">
            <FormLabel>Telefonnummer</FormLabel>
            <FormControl>
              <Input
                value={form.values.phone || ""}
                onChange={e => form.setValues(p => ({ ...p, phone: e.target.value }))}
                placeholder="Telefonnummer"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="email">
            <FormLabel>E-Mail</FormLabel>
            <FormControl>
              <Input
                value={form.values.email || ""}
                onChange={e => form.setValues(p => ({ ...p, email: e.target.value }))}
                placeholder="E-Mail-Adresse"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formTwoCol}>
          <FormItem name="registerNumber">
            <FormLabel>Registernummer</FormLabel>
            <FormControl>
              <Input
                value={form.values.registerNumber || ""}
                onChange={e => form.setValues(p => ({ ...p, registerNumber: e.target.value }))}
                placeholder="Registernummer"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="bankDetails">
          <FormLabel>Bankverbindung (Optional)</FormLabel>
          <FormControl>
            <Textarea
              value={form.values.bankDetails || ""}
              onChange={e => form.setValues(p => ({ ...p, bankDetails: e.target.value }))}
              placeholder="Bankverbindung"
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.switchRow}>
          <Switch
            id="active-toggle"
            checked={form.values.active}
            onCheckedChange={v => form.setValues(p => ({ ...p, active: v }))}
          />
          <label htmlFor="active-toggle" className={styles.switchLabel}>Aktiv</label>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Form>
  );
};