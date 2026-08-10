---
created: 2026-06-09T19:49:51.779Z
updated: 2026-06-09T19:49:51.779Z
---

# Log-Daten Komprimierung

## Summary
Analytics-Rohdaten nach einer kurzen Aufbewahrungsfrist (z.B. 7 Tage) zu täglichen Zusammenfassungen aggregieren und die Einzeldaten danach löschen. Dadurch bleiben alle wichtigen Statistiken dauerhaft erhalten, während der Speicherbedarf drastisch reduziert wird. Statt ~12 MB für 90 Tage Rohdaten bei 500 Nutzern werden nur ~0,5 MB für Jahres-Aggregationen gespeichert.

## Approach

### Schritt 1: Neue Aggregationstabelle `analytics_daily` anlegen

Neue DB-Tabelle mit vorberechneten Tageswerten:

```sql
CREATE TABLE analytics_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  page_path VARCHAR(255) NOT NULL,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  page_visits INTEGER NOT NULL DEFAULT 0,
  tab_clicks INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  avg_duration_seconds NUMERIC(8,2) NOT NULL DEFAULT 0,
  top_tabs JSONB DEFAULT '[]',
  UNIQUE(date, page_path)
);
CREATE INDEX idx_analytics_daily_date ON analytics_daily(date);
```

Jede Zeile = 1 Tag + 1 Seitenpath → ~200 Bytes/Zeile. Bei 10 Seiten × 365 Tage = 3.650 Zeilen/Jahr ≈ **0,7 MB/Jahr** (statt ~50 MB Rohdaten bei 500 Nutzern).

### Schritt 2: Aggregations-Helper `compressLogs` erstellen

Neuer Helper `helpers/compressLogs.tsx`:
- Wird als Scheduled Job täglich um 4:00 Uhr (nach dem Cleanup um 3:00) ausgeführt
- Aggregiert alle `analytics_events` die älter als 7 Tage sind:
  - Gruppiert nach `date` (Tagesdatum) und `page_path`
  - Berechnet: `COUNT(DISTINCT session_id)` als unique_sessions, `COUNT(*)` für page_visits (wo eventType = 'page_visit'), `COUNT(*)` für tab_clicks (wo eventType = 'tab_click'), `SUM(duration_seconds)`, `AVG(duration_seconds)`
  - Speichert die beliebtesten Tab-Klicks als JSON Array in `top_tabs`
- UPSERT (INSERT ... ON CONFLICT UPDATE) in `analytics_daily`
- Löscht anschließend die aggregierten Rohdaten aus `analytics_events`
- Loggt die Anzahl komprimierter und gelöschter Zeilen

### Schritt 3: `cleanupOldData` anpassen

- Retention für `analytics_events` von 90 Tagen auf 7 Tage reduzieren (Rohdaten werden jetzt nach Aggregation nicht mehr benötigt)
- Neue Cleanup-Regel: `analytics_daily` Einträge älter als 2 Jahre löschen (optional, als Sicherheitsnetz)
- Login-Attempts und Sessions bleiben wie gehabt (30 bzw. 7 Tage)

### Schritt 4: Statistik-Endpoint aktualisieren

`endpoints/admin/statistics_GET.ts` anpassen:
- Für Daten der **letzten 7 Tage**: weiterhin direkt aus `analytics_events` lesen (Echtzeitdaten)
- Für Daten **älter als 7 Tage**: aus `analytics_daily` lesen
- Zusammenführen beider Quellen für:
  - `totalVisitors`: Summe unique_sessions aus analytics_daily + aktuelle Woche aus analytics_events
  - `pageVisits`: Kombinierte Daten
  - `tabClicks`: Kombinierte Daten
  - `avgShopDuration` / `avgPlatformDuration`: Gewichteter Durchschnitt aus beiden Quellen
- Die bestehenden Felder `visitorsToday`, `visitorsThisWeek`, `visitorsThisMonth` funktionieren weiterhin korrekt, da die letzten 7 Tage immer als Rohdaten vorliegen

### Schritt 5: Scheduled Job registrieren

In `static/__dev/scheduled-jobs.json` den neuen Job hinzufügen:
```json
{
  "compressLogs": {
    "enabled": true,
    "schedule": "0 4 * * *",
    "timezone": "Europe/Berlin"
  }
}
```

## Files to Create
- `helpers/compressLogs` — Scheduled Job Helper für die tägliche Aggregation von Analytics-Rohdaten in die `analytics_daily` Tabelle

## Files to Modify
- `helpers/cleanupOldData` — Retention für analytics_events von 90 auf 7 Tage reduzieren; optionalen Cleanup für analytics_daily (>2 Jahre) hinzufügen
- `endpoints/admin/statistics_GET` — Statistik-Queries auf Hybrid-Modus umstellen (Rohdaten + Aggregation)
- `endpoints/admin/statistics_GET.schema` — ggf. OutputType erweitern falls neue Felder gewünscht
- `static/__dev/scheduled-jobs.json` — Neuen `compressLogs` Job registrieren (täglich 4:00 Europe/Berlin)
- `helpers/schema` — Nach DB-Migration aktualisieren (pull)

## DB-Schema Änderungen
- Neue Tabelle `analytics_daily` mit Index auf `date`
- Unique Constraint auf `(date, page_path)` für UPSERT-Sicherheit

## Risks & Considerations
- **Datenverlust bei Fehler:** Der Aggregations-Job sollte zuerst INSERT/UPDATE machen und erst danach DELETE. Bei einem Fehler beim Schreiben werden keine Rohdaten gelöscht.
- **Besucher-Zählung über Zeitgrenzen:** `visitorsThisMonth` kann Sessions nicht deduplizieren die sowohl in Rohdaten als auch in Aggregation vorkommen. Lösung: Für den Monatswert nur aus `analytics_daily` + aktuelle Woche zusammenzählen (leichte Überzählung möglich, aber akzeptabel).
- **Scheduled Job Limit:** Mit diesem neuen Job sind 4 von 5 erlaubten Jobs belegt.
- **Erste Ausführung:** Beim ersten Lauf werden alle bestehenden ~1.775 Events aggregiert und gelöscht. Das ist ein einmaliger größerer Vorgang, aber unproblematisch.
- **Abwärtskompatibilität:** Die Admin-Statistik-Seite und der Endpoint behalten dieselbe API-Struktur — keine Breaking Changes für die mobile App.

## Speicher-Einsparung (Hochrechnung 500 Nutzer)

| Szenario | Ohne Komprimierung (90d) | Mit Komprimierung (7d + Aggregation) |
|----------|--------------------------|--------------------------------------|
| analytics_events | ~12 MB | ~1 MB (nur 7 Tage) |
| analytics_daily | — | ~0,7 MB/Jahr |
| **Total nach 1 Jahr** | ~12 MB | ~1,7 MB |
| **Total nach 3 Jahre** | ~12 MB (gedeckelt) | ~3,1 MB |

Einsparung: **~85%** beim Analytics-Speicher. Absolut gesehen sind es ~10 MB — nicht riesig, aber die Aggregation bietet auch den Vorteil schnellerer Statistik-Queries über längere Zeiträume.
