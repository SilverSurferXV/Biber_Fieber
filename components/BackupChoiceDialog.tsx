import React, { useState, useEffect, useMemo } from "react";
import { Database, Users, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import styles from "./BackupChoiceDialog.module.css";

export type BackupCustomer = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  companyName?: string | null;
};

interface BackupChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: BackupCustomer[];
  onBackupAll: () => void;
  onBackupSelected: (userIds: number[]) => void;
  backupLoading: boolean;
  title?: string;
  showCompanyName?: boolean;
}

export const BackupChoiceDialog: React.FC<BackupChoiceDialogProps> = ({
  open,
  onOpenChange,
  customers,
  onBackupAll,
  onBackupSelected,
  backupLoading,
  title = "Datenbank Backup",
  showCompanyName = false,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Reset state when dialog is opened/closed
  useEffect(() => {
    if (open) {
      setStep(1);
      setSearchQuery("");
      setSelectedIds([]);
    }
  }, [open]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        (c.firstName || "").toLowerCase().includes(q) ||
        (c.lastName || "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.companyName || "").toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const allSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.includes(c.id));

  const toggleAll = () => {
    if (allSelected) {
      const filteredIds = new Set(filteredCustomers.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = new Set(filteredCustomers.map((c) => c.id));
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...Array.from(filteredIds)]))
      );
    }
  };

  const toggleCustomer = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className={styles.optionCards}>
            <button
              className={styles.optionCard}
              onClick={onBackupAll}
              disabled={backupLoading}
              type="button"
            >
              <div className={styles.optionIcon}>
                <Database size={24} />
              </div>
              <div className={styles.optionText}>
                <h3>Gesamte Datenbank sichern</h3>
                <p>Alle Kunden und deren Daten exportieren.</p>
              </div>
            </button>
            <button
              className={styles.optionCard}
              onClick={() => setStep(2)}
              disabled={backupLoading}
              type="button"
            >
              <div className={styles.optionIcon}>
                <Users size={24} />
              </div>
              <div className={styles.optionText}>
                <h3>Einzelne Kunden sichern</h3>
                <p>Nur ausgewählte Kunden exportieren.</p>
              </div>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className={styles.step2Container}>
            <div className={styles.searchBar}>
              <Search className={styles.searchIcon} size={18} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suchen nach Name, Email oder Firma..."
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>

            <div className={styles.listHeader}>
              <button
                className={styles.toggleAllBtn}
                onClick={toggleAll}
                type="button"
              >
                {allSelected ? "Keine auswählen" : "Alle auswählen"}
              </button>
              <span className={styles.selectedCount}>
                {selectedIds.length} ausgewählt
              </span>
            </div>

            <div className={styles.customerList}>
              {filteredCustomers.map((c) => (
                <label key={c.id} className={styles.customerRow}>
                  <Checkbox
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCustomer(c.id)}
                  />
                  <div className={styles.customerInfo}>
                    <span className={styles.customerName}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                        "Unbenannt"}
                    </span>
                    <span className={styles.customerEmail}>{c.email}</span>
                    {showCompanyName && c.companyName && (
                      <span className={styles.companyName}>
                        {c.companyName}
                      </span>
                    )}
                  </div>
                </label>
              ))}
              {filteredCustomers.length === 0 && (
                <div className={styles.emptyState}>Keine Kunden gefunden.</div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={backupLoading}
              >
                Zurück
              </Button>
              <Button
                onClick={() => onBackupSelected(selectedIds)}
                disabled={selectedIds.length === 0 || backupLoading}
              >
                {backupLoading
                  ? "Wird gesichert..."
                  : `Backup erstellen (${selectedIds.length} Kunden)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};