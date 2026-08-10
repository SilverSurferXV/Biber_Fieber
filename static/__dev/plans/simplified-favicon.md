---
created: 2026-05-31T11:52:13.958Z
updated: 2026-05-31T11:52:13.958Z
---

# Vereinfachtes Favicon für Browser-Tab

## Summary
Das aktuelle Projekt-Icon (512x512) enthält zu viel Detail (Kreis, Symbol, Text "BIBER FIEBER") und wird im Browser-Tab (16x16/32x32) verzerrt dargestellt. Es soll ein vereinfachtes Icon generiert werden, das nur das Biber-Stern-Symbol ohne Text und Kreisrand zeigt — optimiert für kleine Darstellungsgrößen.

## Approach
1. **Neues vereinfachtes Icon generieren** mit `generateImages`:
   - Nur das Biber-Stern/Splash-Symbol aus dem bestehenden Logo
   - Kein Text, kein Kreisrand
   - Mint/Teal-grünes Symbol auf dunkelgrauem Hintergrund (#2e2e2e)
   - Quadratisch, clean und minimal — gut lesbar bei 16x16px
   - Das bestehende Icon als Referenzbild verwenden

2. **Neues Icon als Projekt-Icon setzen**:
   - Das generierte Icon als `static/project-icon.png` hochladen (ersetzt das bestehende)
   - `updateProjectMetadata` aufrufen um die `iconUrl` zu aktualisieren
   - Floot setzt das automatisch als apple-touch-icon und Favicon ein

3. **Manifest.json aktualisieren**:
   - Die Icon-URLs im `manifest.json` auf das neue Icon anpassen
   - Ggf. eine 192x192 Version generieren für die PWA-Icons

## Files to Modify
- `static/manifest.json` — Icon-URLs auf das neue vereinfachte Icon aktualisieren

## Files to Create
- Generiertes vereinfachtes Favicon-Bild (ersetzt bestehendes `project-icon.png`)

## Risks & Considerations
- Das generierte Icon sollte das Biber-Stern-Symbol wiedererkennbar darstellen
- Falls das Ergebnis nicht passt, kann der User ein eigenes Icon hochladen
- Manifest muss nach Publish aktualisiert sein damit PWA-Icons korrekt sind
