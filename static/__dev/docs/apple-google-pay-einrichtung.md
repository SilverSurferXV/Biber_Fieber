# Einrichtung von Apple Pay und Google Pay

Diese Dokumentation beschreibt, wie Apple Pay und Google Pay im Aufladen-Dialog funktionieren, wie sie konfiguriert werden müssen und was beim Testen (sowohl im Web als auch in der nativen App) zu beachten ist.

## 1. Funktionsweise im Aufladen-Dialog

Technisch werden Apple Pay und Google Pay über das **Stripe ExpressCheckoutElement** im Aufladen-Dialog eingebunden. 
- Das Element lädt automatisch die echten Wallet-Buttons von Stripe.
- Stripe prüft im Hintergrund, ob das aktuelle Gerät und der Browser Apple Pay bzw. Google Pay unterstützen. Wenn keine Unterstützung vorhanden ist (z. B. auf einem Windows-PC ohne Google Pay-Daten oder im Firefox-Browser für Apple Pay), blendet Stripe die Buttons automatisch aus.
- Die Integration von Kreditkarte, Klarna, Sofortüberweisung und PayPal bleibt davon unberührt und funktioniert wie gewohnt.

## 2. Checkliste der nötigen Schritte im Stripe-Dashboard

Damit die Wallet-Zahlungen erfolgreich durchgeführt werden können, müssen folgende Einstellungen im [Stripe Dashboard](https://dashboard.stripe.com/) vorgenommen werden:

1. **Zahlungsmethoden aktivieren:** 
   Navigiere zu *Einstellungen* → *Zahlungen* → *Zahlungsmethoden*. Stelle sicher, dass Apple Pay und Google Pay aktiviert sind.
2. **Payment Method Domains (Zahlungsmethoden-Domains) registrieren:**
   Unter *Einstellungen* → *Zahlungen* → *Payment method domains* (Zahlungsmethoden-Domains) muss die Domain **`biberfieber.floot.app`** hinzugefügt werden.
3. **Apple Merchant Validierung:**
   **Wichtig:** Stripe übernimmt die Apple-Merchant-Validierung vollständig. Es muss **KEINE** Datei unter `/.well-known/apple-developer-merchantid-domain-association` auf dem Server gehostet werden! Bitte befolge für diesen Schritt *nicht* die offizielle Apple-Dokumentation, da Stripe den Prozess kapselt.
4. **Weitere Domains:**
   Falls die Anwendung künftig unter einer eigenen Domain (z.B. `www.biberfieber.de`) erreichbar ist, muss diese zusätzliche Domain ebenfalls im Stripe Dashboard registriert werden.
5. **Google Pay Einschränkung:**
   Google kann für echte Google-Pay-Transaktionen in Live-Umgebungen eine Freigabe des Kontos (Production-Access Approval / "Gateway" integration) verlangen. Bitte prüfe diesbezüglich eventuelle Hinweise im Stripe Dashboard.

## 3. Testen

Beim Testen der Wallet-Buttons sind einige Besonderheiten zu beachten:

- **Floot Editor-Preview:** Die Buttons für Apple Pay und Google Pay erscheinen **NICHT** im Vorschau-Editor von Floot. Das liegt daran, dass Stripe aus Sicherheitsgründen verlangt, dass die Top-Level-Origin (Haupt-URL) mit der iframe-Origin übereinstimmt, was in der Sandbox nicht der Fall ist.
- **Richtiges Testen:** Teste die Wallet-Funktionen direkt auf der veröffentlichten Live-Domain: **`https://biberfieber.floot.app`**
- **Voraussetzungen:** 
  - *Apple Pay:* Kann in Safari (auf macOS oder iOS) getestet werden, vorausgesetzt es ist eine Zahlungskarte in der Wallet hinterlegt.
  - *Google Pay:* Kann in Chrome getestet werden, sofern eine Karte im Google-Konto gespeichert ist.
- **Erinnerung:** Alle Code-Änderungen sind erst nach einem "Publish" in Floot auf der Live-Domain sichtbar.

## 4. Stand native App (iOS / Android Capacitor)

In der als native App generierten Capacitor-Version bleiben die Wallet-Buttons aktuell zunächst leer oder ausgeblendet. Dies hat folgende technische Hintergründe:

- **Capacitor Lokales Bundle:** Die App wird standardmäßig über die lokale Domain `capacitor://localhost` (iOS) geladen. "Apple Pay on the Web" verlangt jedoch zwingend eine sichere `https://`-Verbindung mit einer zuvor registrierten Merchant-Domain.
- **Android WebView Einschränkungen:** Google Pay nutzt im Browser die "PaymentRequest API". Diese ist in Android WebViews standardmäßig deaktiviert, existiert offiziell erst ab WebView-Version 136/137+ und müsste durch einen nativen `setPaymentRequestEnabled`-Aufruf in der `MainActivity` aktiviert werden. Floot bietet derzeit keinen Zugriff auf diese native Java/Kotlin-Datei.

### Der neue Native Browser-Handoff Flow

Um die oben genannten Probleme in der nativen App zu umgehen, nutzen wir den "Native Browser-Handoff Flow":

- Tippt der Nutzer im Aufladen-Dialog in der App auf den "Apple Pay / Google Pay"-Button, erstellt die App einen einmalig gültigen, 30 Minuten haltbaren Token.
- Die App öffnet dann einen sicheren Link (`/aufladen/<token>`) im externen System-Browser (z.B. Safari oder Chrome).
- In diesem Browser-Fenster befindet sich der Nutzer auf der Live-Domain (`https://biberfieber.floot.app`), wodurch die echten Wallet-Buttons von Stripe geladen und angezeigt werden. Als Fallback wird im Browser-Fenster auch die klassische Kreditkarteneingabe angeboten.
- Nach erfolgreicher Zahlung wird das Guthaben sofort auf dem Server gutgeschrieben.
- Der Nutzer kann per Button zurück in die App springen (Deep Link via Capacitor URL Scheme). Da die App beim Zurückkehren automatisch den Status aktualisiert (über das `visibilitychange` Event), ist das neue Guthaben sofort sichtbar.
- Kreditkarte, Klarna, Sofort und PayPal funktionieren weiterhin direkt in der App und benötigen diesen Umweg nicht.

**Vorteile:**
- Es ist **KEIN** neuer App-Build und **KEIN** Apple-Review nötig, da diese Funktionalität komplett über die bestehenden Web-Mechanismen abgewickelt wird.

## 5. Native Wallet-Sheets über das Capacitor-Plugin

Der Floot-Support hat bestätigt: Ein Remote-Bundle (`server.url`) und Origin-Spoofing werden **NICHT** unterstützt (App-Store-Richtlinien + Build-Pipeline). Allerdings **SIND** Capacitor-Plugins in der nativen Build-Pipeline unterstützt! Der Weg über das Plugin ist daher die empfohlene Lösung, um echte native Apple Pay / Google Pay Sheets in der App anzuzeigen.

### Was bereits in der App implementiert ist:
- Der Aufladen-Dialog prüft zur Laufzeit über `helpers/nativeStripeWallet` (ohne npm-Import, direkt über das globale `window.Capacitor`-Objekt), ob das Stripe-Plugin vorhanden ist.
- Wenn das native Binary das Plugin enthält UND das Wallet auf dem Gerät verfügbar ist, erhält der Nutzer das echte Apple Pay / Google Pay Sheet.
- Die Zahlung wird über die bestehenden, unveränderten Endpunkte abgewickelt (`wallet/create-payment-intent` als `credit_card` und `wallet/confirm-topup` als `apple_pay` / `gpay`).
- **Rückwärtskompatibilität / Fallback:** Wenn das Plugin fehlt (z. B. im aktuell veröffentlichten Build), fällt die App automatisch auf den existierenden Browser-Handoff-Button zurück. Nichts bricht, kein Absturz.
- **Android Manifest:** Der Google Pay Manifest-Eintrag (`com.google.android.gms.wallet.api.enabled`) ist bereits in `static/__dev/native/android-manifest.xml` enthalten und wird somit mit jedem Floot-Build ausgeliefert. Es ist keine manuelle Änderung der AndroidManifest.xml nach einem erneuten Download nötig.

### Einmalige Einrichtung (Apple Merchant ID & Zertifikate)
- **Status:** Die Merchant ID `merchant.com.silversurfer.biberfieber` ist im Apple Developer Portal bereits angelegt und stimmt exakt mit der Konstante in `helpers/nativeStripeWallet` überein.
- **Offen:** Es muss noch das zwingend erforderliche **Apple Pay Payment Processing Certificate** eingerichtet werden. Dieses Zertifikat verschlüsselt die Zahlungsdaten bei In-App-Zahlungen über das native iOS SDK.

**Schritt-für-Schritt-Anleitung für das iOS-Zertifikat:**
1. **Neue Anwendung in Stripe erstellen & CSR herunterladen:** 
   Navigiere im Stripe Dashboard zu *Settings → Business Settings → Payment Methods*. Wähle **Apple Pay** und klicke auf **Configure**. Klicke im Abschnitt "iOS certificates" auf **+ Add new application**. Dadurch wird automatisch eine Certificate Signing Request (`.csr`) Datei (meist `stripe.certSigningRequest`) heruntergeladen.
2. **Zertifikat bei Apple generieren:** 
   Wechsle ins Apple Developer Center unter *Certificates, IDs & Profiles → Merchant IDs* und wähle die Merchant ID `merchant.com.silversurfer.biberfieber` aus. Klicke im Abschnitt "Apple Pay Payment Processing Certificate" auf **Create Certificate**. Lade hier die `.csr`-Datei von Stripe hoch. Apple generiert nun eine Zertifikatsdatei mit der Endung `.cer`. Lade diese herunter.
3. **Zertifikat bei Stripe hochladen:** 
   Kehre zurück zum Stripe Dashboard (dort, wo du stehen geblieben bist) und lade die soeben heruntergeladene `.cer`-Datei hoch.

**Wichtige Hinweise:**
- **Zertifikats-Ablauf:** Dieses Zertifikat läuft nach **25 Monaten** ab. Die Erneuerung erfolgt nach exakt demselben Muster (neue CSR aus Stripe holen, neues Zertifikat bei Apple erstellen, neues `.cer` bei Stripe hochladen). Apple verschickt rechtzeitig vor Ablauf Erinnerungen per E-Mail.
- **Abgrenzung zur Web-Domain:** Dieses iOS-Zertifikat ist **NICHT** dasselbe wie die Registrierung der Web-Domain `biberfieber.floot.app` unter "Payment method domains". Für die native App werden beide Konfigurationen parallel benötigt: Die Domain-Registrierung greift für den Browser-Handoff-Fallback, das iOS-Zertifikat wird für das native Payment-Sheet (über das Plugin) benötigt.
- **Keine manuelle Swift-Konfiguration:** In Xcode (Swift) muss keine manuelle SDK-Konfiguration (wie `StripeAPI.defaultPublishableKey`) vorgenommen werden. Der Publishable Key wird automatisch über den Aufruf `initialize()` des Capacitor-Plugins in der Datei `helpers/nativeStripeWallet` gesetzt.
- **Google Pay:** Benötigt keine speziellen Zertifikate (Stripe fungiert als Gateway).

### Checkliste für jeden App-Download (Xcode / Android Studio Build)
Da Floot derzeit keine nativen Entitlements persistiert, müssen folgende Schritte **nach jedem Download des Projekts** für einen nativen Build wiederholt werden:
1. Im heruntergeladenen Projekt-Ordner: Führe exakt `npm i @capacitor-community/stripe@8.1.1` aus (das Projekt nutzt Capacitor 8.0.0). Danach `npx cap sync` ausführen.
2. **Android Gradle-Konfiguration**: Stelle in `android/variables.gradle` sicher, dass `minSdkVersion = 26` und `compileSdkVersion = 36` gesetzt sind. Warnung: Plugin 8.x verlangt mindestens Android SDK 26, bei niedrigerem Wert schlägt der Gradle-Build fehl. Zusätzliche Dependencies sind nicht nötig.
3. **iOS Pod-Konfiguration**: Stelle im `Podfile` (`ios/App/Podfile`) sicher, dass `platform :ios, '15.0'` gesetzt ist (bzw. das iOS-Deployment-Target im Xcode-Target ≥ 15.0 ist). Führe danach `pod install` im Ordner `ios/App` aus.
4. **iOS in Xcode**: Wähle das Target aus → *Signing & Capabilities* → *"+ Capability"* → *Apple Pay* → Setze einen Haken bei der Merchant ID `merchant.com.silversurfer.biberfieber`. (Dies schreibt das zwingend benötigte `com.apple.developer.in-app-payments` Entitlement).
5. **Android**: Nichts weiter im Manifest zu tun. Der nötige Google-Pay-Eintrag ist dank Floot bereits vorhanden.
6. *Hinweise zum Plugin v8:* Google Pay wird in Version 8 rein programmatisch konfiguriert (über `isTesting`). Es sind KEINE `capacitor.config`-Einträge mehr nötig (Floot gibt diese Datei ohnehin nicht frei, unser Code leitet `isTesting` automatisch aus dem Stripe-Key-Prefix ab). Alle alten, als deprecated markierten APIs wurden in v8 entfernt; unsere Code-Aufrufe sind jedoch kompatibel. Das Plugin ist absichtlich **NICHT** in der package.json von Floot eingetragen, da in dieser Datei `@capacitor/core` fehlt.

### Hinweis zum Testen
- Im Browser (und Editor) wurde verifiziert, dass ohne Plugin `getAvailability()` korrekterweise `{applePay:false, googlePay:false, pluginAvailable:false}` zurückgibt. Der Handoff-Fallback bleibt also aktiv.
- Die echten Wallet-Sheets können nur auf einem physischen Gerät (bzw. Simulator) mit einem Build getestet werden, der das Plugin und das iOS-Entitlement enthält.