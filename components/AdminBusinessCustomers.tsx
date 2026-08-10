import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAdminCustomers } from '../helpers/useAdminApi';
import { Button } from './Button';
import { Input } from './Input';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Trash2 } from 'lucide-react';
import { useDebounce } from '../helpers/useDebounce';
import { AdminCustomerRow } from './AdminCustomerRow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { AdminBusinessCustomerCreateForm } from './AdminBusinessCustomerCreateForm';
import { BackupChoiceDialog } from './BackupChoiceDialog';
import { toast } from 'sonner';
import { getAdminBusinessCustomersBackup } from '../endpoints/admin/business-customers/backup_GET.schema';
import { postAdminBusinessCustomersRestore } from '../endpoints/admin/business-customers/restore_POST.schema';
import { postAdminBusinessCustomersDeleteAll } from '../endpoints/admin/business-customers/delete-all_POST.schema';
import styles from './AdminBusinessCustomers.module.css';

type SortColumn = 'name' | 'company' | 'plz' | 'email' | 'points' | 'bibercode' | null;
type SortDirection = 'asc' | 'desc';

export const AdminBusinessCustomers = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data } = useAdminCustomers({ page, search: debouncedSearch || undefined, businessOnly: true });
  const customers = data?.customers || [];

  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const { data: allCustomersData } = useAdminCustomers({ page: 1, limit: 10000, businessOnly: true });
  const allCustomers = (allCustomersData?.customers || []).map(c => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    companyName: c.companyName,
  }));

  const [createOpen, setCreateOpen] = useState(false);

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const handleBackupAll = async () => {
    try {
      setBackupLoading(true);
      const blob = await getAdminBusinessCustomersBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `biber-fieber-firmenkunden-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup erfolgreich erstellt");
      setBackupDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Backups");
    } finally {
      setBackupLoading(false);
    }
  };

    const handleBackupSelected = async (userIds: number[]) => {
    try {
      setBackupLoading(true);
      const blob = await getAdminBusinessCustomersBackup({ userIds });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
      if (userIds.length === 1) {
        const c = allCustomers.find(c => c.id === userIds[0]);
        const name = c ? `${c.firstName || ''}_${c.lastName || ''}`.trim().replace(/\s+/g, '-') : 'firmenkunde';
        a.download = `${dateStr}_${name}.json`;
      } else {
        a.download = `biber-fieber-firmenkunden-backup-${now.toISOString().split('T')[0]}.json`;
      }
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup erfolgreich erstellt");
      setBackupDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Backups");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreOpen(true);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    try {
      setRestoreLoading(true);
      const data = await postAdminBusinessCustomersRestore(restoreFile);
      toast.success(`Backup erfolgreich wiederhergestellt (${data.restoredUsers} Kunden)`);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      setRestoreOpen(false);
      setRestoreFile(null);
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Wiederherstellen");
    } finally {
      setRestoreLoading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (password: string) => postAdminBusinessCustomersDeleteAll({ password }),
    onSuccess: (data) => {
      toast.success(`Alle Kundendaten wurden gelöscht (${data.deletedCount} Kunden entfernt)`);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      setDeleteAllOpen(false);
      setDeletePassword('');
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen");
    }
  });

  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) return <ArrowUpDown size={14} className={styles.sortIcon} />;
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className={styles.sortIconActive} /> 
      : <ArrowDown size={14} className={styles.sortIconActive} />;
  };

  const grouped = customers.reduce((acc, c: any) => {
    const plz = c.postcode || 'Ohne PLZ';
    if (!acc[plz]) acc[plz] = [];
    acc[plz].push(c);
    return acc;
  }, {} as Record<string, typeof customers>);

  const plzs = Object.keys(grouped).sort((a, b) => {
    if (a === 'Ohne PLZ') return 1;
    if (b === 'Ohne PLZ') return -1;
    const cmp = a.localeCompare(b);
    return sortColumn === 'plz' && sortDirection === 'desc' ? -cmp : cmp;
  });

  plzs.forEach(plz => {
    grouped[plz].sort((a: any, b: any) => {
      let valA, valB;
      const activeCol = sortColumn === 'plz' ? 'name' : (sortColumn || 'name');
      const activeDir = sortColumn === 'plz' ? 'asc' : sortDirection;

      switch(activeCol) {
        case 'name':
          valA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
          valB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
          break;
        case 'company':
          valA = (a.companyName || '').toLowerCase();
          valB = (b.companyName || '').toLowerCase();
          break;
        case 'email':
          valA = (a.email || '').toLowerCase();
          valB = (b.email || '').toLowerCase();
          break;
        case 'points':
          valA = Number(a.pointsBalance) || 0;
          valB = Number(b.pointsBalance) || 0;
          break;
        case 'bibercode':
          valA = (a.bibercode || '').toLowerCase();
          valB = (b.bibercode || '').toLowerCase();
          break;
        default:
          valA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
          valB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
      }
      
      if (valA < valB) return activeDir === 'asc' ? -1 : 1;
      if (valA > valB) return activeDir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  const getCityForPlz = (plz: string) => {
    const customersList = grouped[plz] || [];
    const city = customersList.find((c: any) => c.city)?.city;
    return city || null;
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Firmenkunden</h2>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Firmenkunden suchen..."
              className={styles.searchInput}
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>Firmenkunde anlegen</Button>
          <div className={styles.actionBtnGroup}>
            <Button variant="outline" onClick={() => setBackupDialogOpen(true)} disabled={backupLoading}>
              <Download size={16} />
              {backupLoading ? 'Wird erstellt...' : 'Datenbank Backup'}
            </Button>
            <input 
              type="file" 
              accept=".json" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={backupLoading || restoreLoading}>
              <Upload size={16} />
              Datenbank Upload
            </Button>
            <Button variant="destructive" onClick={() => setDeleteAllOpen(true)} className={styles.deleteAllBtn}>
              <Trash2 size={16} />
              Datenbank Löschen
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={`${styles.sortableHeader} ${sortColumn === 'name' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>Name {renderSortIcon('name')}</div>
              </th>
              <th onClick={() => handleSort('company')} className={`${styles.sortableHeader} ${sortColumn === 'company' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>Firmenname {renderSortIcon('company')}</div>
              </th>
              <th>Anrede</th>
              <th onClick={() => handleSort('plz')} className={`${styles.sortableHeader} ${sortColumn === 'plz' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>PLZ {renderSortIcon('plz')}</div>
              </th>
              <th onClick={() => handleSort('email')} className={`${styles.sortableHeader} ${sortColumn === 'email' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>Email {renderSortIcon('email')}</div>
              </th>
              <th onClick={() => handleSort('points')} className={`${styles.sortableHeader} ${sortColumn === 'points' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>Guthaben {renderSortIcon('points')}</div>
              </th>
              <th onClick={() => handleSort('bibercode')} className={`${styles.sortableHeader} ${sortColumn === 'bibercode' ? styles.activeSort : ''}`}>
                <div className={styles.headerContent}>Bibercode {renderSortIcon('bibercode')}</div>
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {plzs.map(plz => (
              <React.Fragment key={plz}>
                <tr className={styles.groupHeader}>
                  <td colSpan={8}>PLZ: {plz}{getCityForPlz(plz) ? ` — ${getCityForPlz(plz)}` : ''}</td>
                </tr>
                {(grouped[plz] || []).map((c: any) => (
                  <AdminCustomerRow key={c.id} customer={c} showCompanyName />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Zurück</Button>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Seite {data.page} von {data.totalPages} ({data.totalCount} Kunden)</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>Weiter</Button>
        </div>
      )}

      {restoreOpen && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setRestoreOpen(false);
            setRestoreFile(null);
          }
        }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Datenbank Wiederherstellen</DialogTitle></DialogHeader>
            <div className={styles.deleteDialogContent}>
              <p>
                Die Kundendaten aus der Backup-Datei <strong>{restoreFile?.name}</strong> werden wiederhergestellt. Bestehende Daten werden nicht überschrieben.
              </p>
              <div className={styles.deleteActions}>
                <Button variant="outline" onClick={() => { setRestoreOpen(false); setRestoreFile(null); }} disabled={restoreLoading}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleRestore} 
                  disabled={restoreLoading}
                >
                  {restoreLoading ? 'Wird wiederhergestellt...' : 'Wiederherstellen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteAllOpen && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setDeleteAllOpen(false);
            setDeletePassword('');
          }
        }}>
          <DialogContent>
            <DialogHeader><DialogTitle>⚠️ Alle Kundendaten löschen</DialogTitle></DialogHeader>
            <div className={styles.deleteDialogContent}>
              <p className={styles.deleteWarning}>
                ACHTUNG: Diese Aktion löscht unwiderruflich alle Kundendaten aus der Datenbank. Nur Admin-Konten bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: '0.875rem' }}>Admin-Passwort zur Bestätigung</label>
                <Input 
                  type="password" 
                  value={deletePassword} 
                  onChange={e => setDeletePassword(e.target.value)} 
                  placeholder="Passwort eingeben" 
                />
              </div>
              <div className={styles.deleteActions}>
                <Button variant="outline" onClick={() => { setDeleteAllOpen(false); setDeletePassword(''); }}>Abbrechen</Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteMutation.mutate(deletePassword)} 
                  disabled={!deletePassword || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Wird gelöscht...' : 'Endgültig löschen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {createOpen && (
        <Dialog open={true} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Firmenkunde anlegen</DialogTitle></DialogHeader>
            <AdminBusinessCustomerCreateForm 
              onClose={() => {
                setCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
              }} 
            />
          </DialogContent>
        </Dialog>
      )}

      <BackupChoiceDialog
        open={backupDialogOpen}
        onOpenChange={setBackupDialogOpen}
        customers={allCustomers}
        onBackupAll={handleBackupAll}
        onBackupSelected={handleBackupSelected}
        backupLoading={backupLoading}
        title="Firmenkunden Backup"
        showCompanyName={true}
      />
    </div>
  );
};