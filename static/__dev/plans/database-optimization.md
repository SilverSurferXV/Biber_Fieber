---
created: 2026-05-06T08:54:51.256Z
updated: 2026-05-06T08:57:57.987Z
---


# Datenbank-Optimierung: Verschlankung für bessere Performance

## Summary
Die Datenbank enthält große base64-kodierte Bilder und PDFs, die bei jedem Query mitgeladen werden und die Geschwindigkeit stark beeinträchtigen. Der Plan umfasst: Komprimierung der verbleibenden base64-Produktfotos, Optimierung der Endpoints (selektive Spaltenabfragen statt `SELECT *`), Session-/Login-Cleanup und VACUUM.

## Aktuelle Datenbankgröße
- **product_categories**: 2.656 KB (base64-Fotos, bereits komprimiert auf ~620KB Nutzdaten)
- **products**: 1.352 KB (4 Produkte mit base64-Fotos bis 197KB, Rest URL-Referenzen)
- **sonderbereich_files**: 648 KB (3 PDFs als base64 ~558KB)
- **users**: 248 KB (Dropoff-Fotos als base64 ~37KB)
- **sessions**: 96 KB (möglicherweise abgelaufene Sessions)
- **login_attempts**: 56 KB (alte Einträge)

## Approach

### Phase 1: Produktfotos komprimieren (sofort)
Die 4 verbleibenden Produktfotos mit base64 (IDs: 18, 19, 20, 101) auf 512x512px bei JPEG 0.92 verkleinern — visuell verlustfrei bei der Anzeigegröße.

### Phase 2: Endpoint-Optimierung (SELECT-Felder einschränken)
Statt `selectAll()` nur die tatsächlich benötigten Spalten abfragen. Das verhindert, dass base64-Daten unnötig über die Leitung gehen.

**Betroffene Endpoints:**
- `endpoints/products/list_GET.ts` — Produktliste: `photo_url` wird benötigt, aber nur als Thumbnail. Separate Spaltenauswahl statt `selectAll()`.
- `endpoints/admin/products_GET.ts` — Admin-Produktliste: ditto.
- `endpoints/admin/customers_GET.ts` — Kundenliste: `selectAll()` lädt avatar_url und dropoff_photo_url mit. Auf spezifische Spalten umstellen; Foto-Daten nur bei Bedarf im Detail-View laden.
- `endpoints/categories/list_GET.ts` — Kategorieliste: `photo_url` wird für die Icons benötigt, aber die Daten sind jetzt komprimiert.

### Phase 3: Alte Daten bereinigen (SQL-Cleanup)
- Abgelaufene Sessions löschen: `DELETE FROM sessions WHERE expires_at < NOW()`
- Alte Login-Versuche löschen: `DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days'`
- `VACUUM ANALYZE` auf allen Tabellen ausführen

## Files to Modify
- `endpoints/products/list_GET.ts` — SELECT-Spalten einschränken
- `endpoints/admin/products_GET.ts` — SELECT-Spalten einschränken
- `endpoints/admin/customers_GET.ts` — SELECT-Spalten einschränken, Foto-Daten nur bei Detail-Abruf
- `endpoints/categories/list_GET.ts` — Prüfen ob `selectAll()` verwendet wird

## Files to Create
Keine neuen Dateien nötig.

## Risks & Considerations
- **Komprimierung der Produktfotos**: Ähnlich wie bei den Kategorien — visuell verlustfrei, aber technisch wird das Originalbild ersetzt.
- **Endpoint-Änderungen**: Frontend-Code muss eventuell angepasst werden, wenn bisher Felder erwartet werden, die nicht mehr im Response sind.
- **VACUUM**: Kann kurzzeitig die DB belasten, ist aber bei dieser Datenbankgröße unkritisch.
