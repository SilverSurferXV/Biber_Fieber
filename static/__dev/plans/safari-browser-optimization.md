---
created: 2026-05-07T12:01:44.104Z
updated: 2026-05-07T12:01:44.104Z
---

# Safari Browser Optimierung

## Summary
Umfassende Safari-Kompatibilitätsoptimierung für die Biber Fieber Plattform. Safari (iOS & macOS) hat bekannte Eigenheiten bei CSS-Properties die zu Darstellungsproblemen führen können.

## Identifizierte Probleme

### 1. Fehlender `-webkit-backdrop-filter` Prefix
**Datei:** `components/Sheet.module.css`
Safari benötigt `-webkit-backdrop-filter` zusätzlich zu `backdrop-filter`.

### 2. `scale` als individuelle Transform-Property in Keyframes
**Datei:** `components/Dialog.module.css`
Die `contentShow` Keyframe-Animation nutzt `scale: 0.95` / `scale: 1` als individuelle CSS-Property. Safari < 16 unterstützt das nicht. Muss auf `transform: scale()` umgestellt werden.

### 3. `zoom: 0.85` auf Mobile
**Datei:** `pages/checkout.module.css`
Safari behandelt `zoom` inkonsistent. Sollte durch `transform: scale(0.85)` mit `transform-origin: top left` und `width: calc(100% / 0.85)` ersetzt werden, um konsistentes Verhalten zu gewährleisten.

### 4. `-webkit-background-clip: text` ohne Standard-Property
**Dateien:** `pages/_index.module.css`, `components/AccountViews.module.css`
Es wird nur `-webkit-background-clip: text` genutzt, aber der Standard `background-clip: text` fehlt. Für volle Kompatibilität sollten beide angegeben werden.

### 5. `scrollbar-width: thin` nicht unterstützt
**Datei:** `pages/shop.module.css`
Safari unterstützt `scrollbar-width` nicht. Muss mit `::-webkit-scrollbar` Pseudo-Elementen ergänzt werden.

### 6. `100vh` Problem auf iOS Safari
**Dateien:** `components/AppLayout.module.css` (`min-height: 100vh`), `pages/shop.module.css` (`max-height: calc(100vh - 100px)`)
iOS Safari berechnet `100vh` inkl. der Adressleiste, was zu Darstellungsproblemen führt. Fallback mit `-webkit-fill-available` oder `100svh` (small viewport height) hinzufügen.

### 7. `inset: 0` Shorthand
**Dateien:** `components/Dialog.module.css`, `components/Sheet.module.css`, `pages/shop.module.css`
Ältere Safari-Versionen (< 14.1) unterstützen `inset` nicht. Fallback mit `top: 0; right: 0; bottom: 0; left: 0;` hinzufügen.

### 8. `position: sticky` Kompatibilität
**Datei:** `pages/shop.module.css`
Ältere Safari-Versionen benötigen `-webkit-sticky`. Zusätzlich Safari-Bug: `sticky` funktioniert nicht korrekt wenn ein Eltern-Element `overflow: hidden` hat — prüfen ob das hier der Fall ist.

## Files to Modify

1. **`components/Sheet.module.css`** — `-webkit-backdrop-filter` hinzufügen
2. **`components/Dialog.module.css`** — `scale` → `transform: scale()` in Keyframes; `inset` Fallback
3. **`pages/checkout.module.css`** — `zoom` durch `transform: scale()` ersetzen
4. **`pages/_index.module.css`** — `background-clip: text` Standard-Property hinzufügen
5. **`components/AccountViews.module.css`** — `background-clip: text` Standard-Property hinzufügen
6. **`components/AppLayout.module.css`** — `100vh` Fallback für iOS Safari
7. **`pages/shop.module.css`** — `scrollbar-width` Fallback mit `::-webkit-scrollbar`; `100vh` Fallback; `inset` Fallback; `-webkit-sticky` hinzufügen; `100vh` Fallback für `max-height`
8. **`pages/liefergebiet.module.css`** — `100vh` Fallback für `calc(100vh - 300px)` Map-Höhe

## Files to Create
Keine neuen Dateien nötig.

## Approach

1. Alle CSS-Dateien mit den identifizierten Änderungen aktualisieren — gruppiert als ein einziger updateItems-Call wo möglich, sonst replaceInFiles für einfache Prefix-Ergänzungen.
2. Die Änderungen sind rein CSS-basiert und beeinflussen keine Logik.
3. Reihenfolge der Properties beachten: Webkit-Prefix zuerst, dann Standard-Property (für Progressive Enhancement).

## Risks & Considerations

- **`color-mix()`**: Wird 131+ Mal genutzt, aber erst ab Safari 16.2 unterstützt. Ein vollständiger Fallback wäre sehr aufwändig und betrifft vor allem ältere Geräte (iPhone 7 und älter mit iOS 15). Für moderne Nutzer (iOS 16+, macOS Ventura+) ist das kein Problem. Empfehlung: Nicht ändern, da der Aufwand unverhältnismäßig wäre.
- **`aspect-ratio`**: Wird in shop.module.css und Chart.module.css genutzt, Safari 15+ unterstützt es. Kein Handlungsbedarf für aktuelle Safari-Versionen.
- **`gap` in Flexbox**: Safari 14.1+ unterstützt es, kein Handlungsbedarf.
- Die `zoom`-Ersetzung durch `transform: scale()` kann Layout-Shift verursachen — muss sorgfältig mit `transform-origin` und `width`-Anpassung kompensiert werden.
