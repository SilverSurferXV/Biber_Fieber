import React, { useState } from 'react';
import { useAdminLoginHistoryQuery } from '../helpers/useAdminLoginHistory';
import { useDebounce } from '../helpers/useDebounce';
import { Input } from './Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { parseUserAgent } from '../helpers/parseUserAgent';
import { Search } from 'lucide-react';
import styles from './AdminLoginHistory.module.css';

const dateFormatter = new Intl.DateTimeFormat("de-DE", { 
  timeZone: "Europe/Berlin", 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit' 
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", { 
  timeZone: "Europe/Berlin", 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
});

export const AdminLoginHistory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [status, setStatus] = useState<"all" | "success" | "failed">("all");

  const { data, isFetching, error } = useAdminLoginHistoryQuery({
    page: 1,
    pageSize: 100,
    search: debouncedSearch,
    status
  });

  // Helper renderers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderAccount = (row: any) => {
    if (row.userId || row.displayName) {
      const name = row.firstName || row.lastName 
        ? `${row.firstName || ''} ${row.lastName || ''}`.trim() 
        : row.displayName;
      
      const roleLabel = row.role === 'admin' ? 'Admin' : row.role === 'driver' ? 'Fahrer' : row.role === 'user' ? 'Kunde' : row.role;
      
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span style={{ fontWeight: 500 }}>{name}</span>
            {roleLabel && (
              <Badge variant="outline" style={{ fontSize: '0.65rem', padding: '0 var(--spacing-2)', height: '1.25rem' }}>
                {roleLabel}
              </Badge>
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{row.email}</div>
        </div>
      );
    }
    
    return (
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{row.email}</div>
      </div>
    );
  };

  const renderLocation = (loc: any, ip: string | null) => {
    if (!ip) return <div>-</div>;
    
    if (loc?.isPrivate) {
      return (
        <div>
          <div style={{ fontWeight: 500 }}>Lokales Netzwerk</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{ip}</div>
        </div>
      );
    }
    
    if (!loc || loc.failed || (!loc.city && !loc.country)) {
      return (
        <div>
          <div style={{ fontWeight: 500 }}>Unbekannt</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{ip}</div>
        </div>
      );
    }
    
    const parts = [loc.city, loc.region, loc.country].filter(Boolean);
    return (
      <div>
        <div style={{ fontWeight: 500 }}>{parts.join(', ')}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{ip}</div>
      </div>
    );
  };

  const renderDevice = (ua: string | null, platform: string | null, source: string | null) => {
    const parsed = parseUserAgent(ua, platform);
    
    let hint = "";
    if (source === "driver") {
      hint = "Fahrer-Login";
    } else if (platform === "ios-app") {
      hint = "App (iOS)";
    } else if (platform === "android-app") {
      hint = "App (Android)";
    } else if (platform === "web") {
      hint = "Web";
    }

    return (
      <div title={ua || "Unbekannt"} style={{ cursor: ua ? 'help' : 'default' }}>
        <div style={{ fontWeight: 500 }}>{parsed.deviceLabel}</div>
        {hint && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{hint}</div>}
      </div>
    );
  };

  const displayedCount = data?.rows?.length ?? 0;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitleGroup}>
            <h2>Login Historie</h2>
            <span className={styles.entryCount}>
              {isFetching && !data ? "..." : `${displayedCount} von max. 100 Einträgen`}
            </span>
          </div>
        </div>
        <p className={styles.hintText}>
          Es werden nur die 100 neuesten Logins gespeichert. Ältere Einträge werden automatisch gelöscht.
        </p>
        
        <div className={styles.filters}>
          <div style={{ position: "relative", width: "250px" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: "var(--spacing-3)",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted-foreground)",
                pointerEvents: "none",
              }}
            />
            <Input
              type="search"
              placeholder="Suchen nach Email, Name, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "calc(var(--spacing-3) * 2 + 18px)" }}
            />
          </div>
          
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | "success" | "failed")}>
            <SelectTrigger style={{ width: '180px' }}>
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="success">Erfolgreich</SelectItem>
              <SelectItem value="failed">Fehlgeschlagen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Datum / Zeit</th>
              <th>Account</th>
              <th>Standort</th>
              <th>Gerät</th>
              <th>Status</th>
            </tr>
          </thead>
          
          {isFetching && !data ? (
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <Skeleton style={{ width: '80px', height: '1.25rem' }} />
                    <Skeleton style={{ width: '60px', height: '1rem', marginTop: '4px' }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: '120px', height: '1.25rem' }} />
                    <Skeleton style={{ width: '100px', height: '1rem', marginTop: '4px' }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: '150px', height: '1.25rem' }} />
                    <Skeleton style={{ width: '90px', height: '1rem', marginTop: '4px' }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: '130px', height: '1.25rem' }} />
                    <Skeleton style={{ width: '70px', height: '1rem', marginTop: '4px' }} />
                  </td>
                  <td>
                    <Skeleton style={{ width: '80px', height: '1.5rem', borderRadius: '1rem' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              {(data?.rows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.attemptedAt ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {dateFormatter.format(new Date(row.attemptedAt))}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                          {timeFormatter.format(new Date(row.attemptedAt))}
                        </div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{renderAccount(row)}</td>
                  <td>{renderLocation(row.location, row.ipAddress)}</td>
                  <td>{renderDevice(row.userAgent, row.clientPlatform, row.loginSource)}</td>
                  <td>
                    {row.success 
                      ? <Badge variant="success">Erfolgreich</Badge> 
                      : <Badge variant="destructive">Fehlgeschlagen</Badge>
                    }
                  </td>
                </tr>
              ))}
              
              {data?.rows?.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
                    Keine Logins gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
};