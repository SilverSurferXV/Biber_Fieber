---
created: 2026-08-25T08:45:49.662Z
updated: 2026-08-25T08:45:49.662Z
---

# Apple Pay & Google Pay beim Guthaben-Aufladen wirklich funktionsfähig machen

## Problem (Ursache, belegt im Code)

In `components/TopupPaymentDialog.tsx` sind „Google Pay" und „Apple Pay" nur zwei selbstgebaute `<button>`-Kacheln mit einem Lucide-Icon. Beim Klick passiert genau dasselbe wie bei „Kreditkarte":

1. `handleSelectMethod` ruft `wallet/create-payment-intent` auf. Das Backend setzt für `gpay` und `apple_pay` `payment_method_types: ["card"]`.
2. Der Dialog wechselt zu `step: 'payment'` und rendert immer nur `<PaymentElement />` — also das Kreditkartenformular.

Es existiert nirgends ein echter Wallet-Button (Stripe `ExpressCheckoutElement` bzw. `PaymentRequestButton`). Deshalb kann sich das Apple-Pay-/Google-Pay-Sheet gar nicht öffnen — das Verhalten ist kein Bug im engeren Sinn, die Funktion war nie implementiert.

Zusätzlich fehlen zwei Voraussetzungen außerhalb des Codes: die Domain-Registrierung bei Stripe („Payment method domains") und die Aktivierung der beiden Wallets in den Stripe-Zahlungsmethoden. Ohne diese blendet Stripe die Wallet-Buttons still aus.

## Umfang

Phase 1 (Browser, jetzt umsetzbar): echte Apple-Pay-/Google-Pay-Buttons über Stripes `ExpressCheckoutElement`, sofort nach dem Publish auf `biberfieber.floot.app` wirksam.

Phase 2 (native iOS/Android App): Recherche-Ergebnis vorweg, weil es die Entscheidung bestimmt — Details unten unter „Native App".

## Pages

`pages/account` → Tab „Guthaben" (`components/AccountPoints` → `components/TopupPaymentDialog`). Keine neue Seite, keine Routenänderung.

## User accounts

Unverändert. Aufladen bleibt eingeloggten Kunden vorbehalten, die Profil-Vollständigkeitsprüfung und die 18-Jahre-Prüfung im Endpoint bleiben exakt wie sie sind.

## Look & feel

Der Aufladen-Dialog wird umgebaut, weil die aktuelle „erst Methode wählen, dann bezahlen"-Struktur mit Wallets technisch nicht funktioniert (Wallet-Buttons müssen von Stripe gerendert werden und sich selbst ausblenden, wenn das Gerät sie nicht kann):

- **Oben: Wallet-Bereich.** Stripes `ExpressCheckoutElement` rendert dort die echten, originalgetreuen Apple-Pay- bzw. Google-Pay-Buttons. Stripe zeigt nur, was das Gerät tatsächlich unterstützt — auf einem Windows-PC ohne Wallet erscheint dort nichts.
- Ist kein Wallet verfügbar, wird der Bereich komplett ausgeblendet und stattdessen ein dezenter Hinweis gezeigt: „Apple Pay / Google Pay ist auf diesem Gerät oder in diesem Browser nicht verfügbar." So klickt niemand mehr ins Leere.
- Darunter ein Trenner („oder mit") und die bestehende Kachel-Auswahl — allerdings **ohne** die beiden Fake-Kacheln Apple Pay und Google Pay. Es bleiben: Klarna, Sofort, PayPal, Kreditkarte.
- Kreditkarte/Klarna/PayPal verhalten sich unverändert (PaymentElement bzw. PayPal-Buttons), gleiche Optik wie heute.
- Neue Texte werden in allen fünf Sprachen ergänzt (`translationsDe/En/Es/It/Tr`), Stil und Schlüssel-Namensschema wie die bestehenden `topup.*`-Keys.

## What it remembers

Nichts Neues in der Datenbank. Der Enum `payment_method_type` enthält `apple_pay` und `gpay` bereits — Wallet-Zahlungen werden künftig erstmals korrekt mit dem tatsächlich benutzten Wallet in `walletTopups` gespeichert (bisher hätte alles als Karte durchgelaufen). Bonus-Staffeln, Punkte-Gutschrift und der Doppelbuchungsschutz in `wallet/confirm-topup` bleiben unverändert.

## How it works

### Frontend (`components/TopupPaymentDialog`)

- Beim Öffnen des Dialogs wird sofort **eine** PaymentIntent für Karten/Wallets erzeugt (bestehender Endpoint, `paymentMethod: 'credit_card'`), da `ExpressCheckoutElement` ein `clientSecret` benötigt, um überhaupt gerendert zu werden. Während des Ladens ein Skeleton.
- Diese `<Elements>`-Instanz trägt sowohl den Wallet-Bereich als auch das Kartenformular — es wird also keine zweite PaymentIntent für Karte mehr gebraucht.
- `ExpressCheckoutElement` wird auf Apple Pay + Google Pay beschränkt (Link, PayPal, Amazon Pay dort auf `never`, weil PayPal im Dialog schon eigene Buttons hat).
- `onReady` liefert die verfügbaren Methoden — daraus wird gesteuert, ob der Wallet-Bereich oder der Nicht-verfügbar-Hinweis erscheint.
- `onConfirm`: `stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url }, redirect: 'if_required' })`. Bei Erfolg wird `wallet/confirm-topup` gerufen, wobei die Methode aus `event.expressPaymentType` gemappt wird: `apple_pay` → `apple_pay`, `google_pay` → `gpay`, sonst `credit_card`. Erfolgs-/Fehler-Toasts wie bisher; Abbruch durch den Nutzer erzeugt keine Fehlermeldung.
- Klarna/Sofort erzeugen wie bisher beim Klick ihre eigene PaymentIntent (`payment_method_types: ["klarna"]`), PayPal läuft weiter über die PayPal-Buttons.

### Backend

Keine Breaking Changes — wichtig, weil die App als native App veröffentlicht ist. `wallet/create-payment-intent` und `wallet/confirm-topup` behalten Route, Schema und Antwortform. Die Wallet-Werte `apple_pay`/`gpay` sind im Schema schon erlaubt, für sie ist `payment_method_types: ["card"]` korrekt (Apple/Google Pay sind bei Stripe Karten-Wallets). Einzige Ergänzung: im Metadata-Feld der PaymentIntent wird zusätzlich vermerkt, dass die Intent Wallet-fähig ist, damit Zahlungen im Stripe-Dashboard eindeutig zuordenbar sind.

### Testen

Wallet-Buttons erscheinen **nicht** im Floot-Editor-Preview: Stripe verlangt, dass die iframe-Origin der Top-Level-Origin entspricht. Getestet wird daher auf `https://biberfieber.floot.app` — Apple Pay in Safari (macOS/iOS) mit Karte in der Wallet, Google Pay in Chrome mit gespeicherter Karte im Google-Konto.

## Outside services

### Stripe-Einrichtung (muss vom Nutzer im Dashboard gemacht werden, sonst bleiben die Buttons unsichtbar)

1. **Wallets aktivieren:** Stripe Dashboard → Einstellungen → Zahlungen → Zahlungsmethoden → „Apple Pay" und „Google Pay" einschalten.
2. **Domain registrieren:** Einstellungen → Zahlungen → **Payment method domains** → „Neue Domain hinzufügen" → `biberfieber.floot.app`. Stripe übernimmt die Apple-Merchant-Validierung komplett selbst; es muss **keine** Datei unter `/.well-known/…` hochgeladen werden und der Apple-Merchant-Validierungsprozess aus Apples Doku darf ausdrücklich nicht befolgt werden. Diese Registrierung gilt für Apple Pay, Google Pay, Link und PayPal.
3. Falls später eine eigene Domain (z. B. `biberfieber.de`) dazukommt, muss diese ebenfalls registriert werden.
4. Google Pay live: Stripe deckt die Gateway-Integration ab; für echte Transaktionen kann Google eine Freigabe des Kontos verlangen.

Diese Schritte werden zusätzlich als Anleitung in `static/__dev/docs/apple-google-pay-einrichtung.md` festgehalten.

### Native App (iOS TestFlight / Android)

Recherche-Ergebnis, ehrlich und ohne Beschönigung:

- **Web-Weg in der Capacitor-App:** Die App lädt ihr Bundle heute über `capacitor://localhost` — keine `https`-Origin. Apple Pay on the Web verlangt HTTPS mit registrierter Merchant-Domain, deshalb ist `ApplePaySession` in einer Standard-Capacitor-App nicht verfügbar; die Wallet-Buttons bleiben dort einfach leer (Kreditkarte, Klarna, PayPal funktionieren weiter). Google Pay im Android-WebView setzt WebView 137+ **und** einen nativen `setPaymentRequestEnabled`-Aufruf in der MainActivity voraus, den Floot nicht bereitstellt.
- **Möglicher Web-Workaround:** Lädt die native App die Seite von der echten Domain (Remote-Bundle über `server.url`, siehe bestehendes Dokument `static/__dev/docs/native-app-updates-ohne-review.md`), ist die Origin `https://biberfieber.floot.app` und Apple Pay JS kann ab iOS 16 grundsätzlich funktionieren. Das ist nicht offiziell dokumentiert und muss auf einem echten Gerät getestet werden — potenziell aber der günstigste Weg, weil kein natives Plugin nötig ist.
- **Nativer Weg (`@capacitor-community/stripe`):** Das Plugin kann eine bestehende PaymentIntent per Apple Pay/Google Pay bezahlen und würde technisch perfekt zum vorhandenen Backend passen. Blocker: natives Apple Pay verlangt zwingend eine Apple Merchant ID plus das Entitlement `com.apple.developer.in-app-payments` (Xcode-Capability „Apple Pay") im Provisioning-Profil. Floot gibt aktuell nur `static/__dev/native/ios-info.plist` und `static/__dev/native/android-manifest.xml` frei — eine `.entitlements`-Datei bzw. die Apple-Pay-Capability ist darüber nicht setzbar. Für Android wäre es machbar (Manifest-`meta-data` `com.google.android.gms.wallet.api.enabled` lässt sich in der freigegebenen Manifest-Datei ergänzen).

**Vorgeschlagene Reihenfolge:** Phase 1 (Browser) umsetzen und publishen — damit funktionieren Apple Pay und Google Pay auf allen Web-Zugängen inklusive iPhone-Safari. Danach in der TestFlight-App prüfen, ob die Wallet-Buttons erscheinen. Erscheinen sie dort nicht, entscheiden wir zwischen dem Remote-Bundle-Workaround (kein Store-Review nötig) und dem nativen Plugin, für das der Apple-Pay-Entitlement-Support bei Floot angefragt werden müsste. In beiden Fällen bleibt die App in der Zwischenzeit voll zahlungsfähig über Kreditkarte, Klarna, Sofort und PayPal.

## Dateien

- `components/TopupPaymentDialog.tsx` / `.module.css` — Wallet-Bereich via `ExpressCheckoutElement`, Fake-Kacheln entfernt, eine gemeinsame PaymentIntent für Wallet+Karte.
- `endpoints/wallet/create-payment-intent_POST.ts` — nur Metadata-Ergänzung, voll rückwärtskompatibel.
- `helpers/translationsDe|En|Es|It|Tr.tsx` — neue `topup.*`-Texte.
- `static/__dev/docs/apple-google-pay-einrichtung.md` — Anleitung Stripe-Dashboard + Teststrategie + Stand native App.
