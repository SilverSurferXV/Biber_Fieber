# Build-Anleitung: Apple Pay & Google Pay in der native App aktivieren

Dieses Dokument richtet sich an den nativen Entwickler (iOS/Android / Codemagic). Es beschreibt alle notwendigen Schritte für **einen** neuen nativen Build, um Apple Pay und Google Pay (via Stripe) nativ in der App nutzbar zu machen.

## 1. Ausgangslage

* **Diagnose aus den Logs:** Die aktuell installierte App liefert ein lokales Web-Bundle aus (die gemessene Origin lautet `capacitor://localhost`). Der aufgezeichnete Test lief auf iOS (User-Agent `Macintosh; Intel Mac OS X 10_15_7` ohne Safari/Version Token = iOS WKWebView). Das Fehlen des Telemetrie-Beacons in den Logs beweist *nicht*, dass die App alten Code ausführt, da das frühere Beacon eine relative URL nutzte, welche im nativen Build ins Leere lief.
* **Folge:** Bewiesen ist, dass die App ein lokales Bundle nutzt und die nativen Wallet-Verfügbarkeitsprüfungen fehlschlugen, weshalb die App korrekt auf den **Browser-Handoff-Fallback** zurückgriff. 
* **Hauptverdächtiger (Capacitor 8 ist in der Pipeline bestätigt):** Da Capacitor 8 genutzt wird, ist die Wahrscheinlichkeit hoch, dass das Stripe-Plugin zwar kompiliert wurde, aber **Apple Pay nicht korrekt signiert ist**. Ein fehlendes Entitlement (`com.apple.developer.in-app-payments`), eine fehlende Capability im Provisioning Profile oder eine abweichende Merchant ID führen dazu, dass `isApplePayAvailable()` stillschweigend einen Fehler wirft – was für die App exakt so aussieht, als ob das Plugin fehlen würde. Dass das Plugin komplett im Binary fehlt, ist die sekundäre Ursache.
* **Status Quo:** Die aktuelle iOS-Build-Nummer ist `38`. In der `AndroidManifest.xml` ist der für Google Pay benötigte Meta-Data-Eintrag bereits durch das Floot-System vorhanden (hier muss also nicht händisch eingegriffen werden).

## 2. Feste Projektwerte

Diese Werte müssen bei der Einrichtung in Xcode / Stripe / Apple Developer exakt übereinstimmen:

| Eigenschaft | Wert |
| :--- | :--- |
| **App-ID (Bundle ID)** | `com.silversurfer.biberfieber` |
| **Live-Domain** | `https://biberfieber.floot.app` |
| **Apple Merchant ID** | `merchant.com.silversurfer.biberfieber` *(Ist hartcodiert in `MERCHANT_IDENTIFIER`!)* |
| **Custom URL Scheme** | `app.floot.u5b3d39f96d074ac4a072a41647c58fec` |
| **Stripe Publishable Key** | Ist ein **Live-Key** (`pk_live_...`) |

## 3. Schritt 1 — Stripe-Plugin einbauen

Das Frontend nutzt dynamisches Laden (`window.Capacitor.Plugins.Stripe`), daher muss das Plugin lediglich in den nativen Projekten installiert sein.

1. Installiere das Paket im Projektordner: `npm install @capacitor-community/stripe@8.2.1`
2. **Warnung zu Capacitor-Versionen:** Version 8.x des Stripe-Plugins erfordert zwingend `@capacitor/core` in Version 8 oder höher. Ist das Projekt auf Capacitor < 8, schlägt der Build fehl oder das Plugin wird ignoriert. Capacitor muss in diesem Fall vorher per `npm i @capacitor/core@8 @capacitor/ios@8 @capacitor/android@8` etc. aktualisiert werden.
3. Führe den Sync aus:
   ```bash
   npx cap sync ios
   npx cap sync android
   ```
4. **Android:** In der Datei `android/variables.gradle` muss die `minSdkVersion` mindestens auf `24` (oder höher, empfohlen `26`) stehen.
5. Es ist **keine** weitere manuelle Registrierung in Swift oder Java/Kotlin erforderlich.

## 4. Schritt 2 — Apple Pay (iOS)

Apple Pay lässt sich **nicht** über die `Info.plist` konfigurieren. Es erfordert ein echtes Entitlement im Xcode-Projekt:

1. **Apple Developer Portal:** Stelle sicher, dass die Merchant ID `merchant.com.silversurfer.biberfieber` registriert ist.
2. **Stripe Dashboard:** Erstelle ein Apple Pay-Zertifikat für genau diese Merchant ID und lade es hoch.
3. **Xcode:** Öffne `ios/App/App.xcworkspace`. Gehe zu *Signing & Capabilities* → *+ Capability* → **Apple Pay**. Wähle in der Liste die Merchant ID `merchant.com.silversurfer.biberfieber` aus (dies erzeugt das Entitlement `com.apple.developer.in-app-payments`).
4. **Wichtig:** Das genutzte Provisioning Profile muss diese Capability enthalten. Stimmt die hier gewählte Merchant ID nicht *exakt* mit der in Schritt 2 genannten überein, schlägt `isApplePayAvailable()` ohne Crash stumm fehl, und der Button erscheint nicht in der App.
5. **Checkliste VOR dem Build:**
   - [ ] Merchant ID `merchant.com.silversurfer.biberfieber` existiert exakt so im Apple Developer Portal.
   - [ ] Im Stripe Dashboard ist das Apple Pay-Zertifikat für exakt diese Merchant ID hinterlegt.
   - [ ] Die Capability ist im Provisioning Profile enthalten, das von Codemagic zum Signieren genutzt wird.

## 5. Schritt 3 — Google Pay (Android)

1. Der Manifest-Eintrag `<meta-data android:name="com.google.android.gms.wallet.api.enabled" android:value="true" />` ist durch Floot bereits in `android/app/src/main/AndroidManifest.xml` integriert. Stelle sicher, dass dieser nach dem Sync nicht überschrieben wird.
2. **Stripe Dashboard:** Google Pay muss im Stripe-Dashboard aktiviert sein.
3. **Wichtig zum Testen:** Google Pay lässt sich in der Regel **nicht** auf Emulatoren testen. Für einen echten Test wird ein physisches Android-Gerät mit einer in der Google Wallet hinterlegten Karte benötigt.

## 6. Schritt 4 (dringend empfohlen) — Umstellung auf Remote-Bundle (Option A)

Wenn dieser neue Build ohnehin eingereicht wird, sollte die App zwingend auf ein **Remote-Bundle** umgestellt werden. Grund: Das bisherige CORS/Cookie-Problem wird gelöst und zukünftige Frontend-Updates (Texte, Farben, Checkouts) sind sofort live, ohne auf Apple-Reviews warten zu müssen.

Füge in der Datei `capacitor.config.ts` (oder `.json`) den `server`-Block hinzu:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.silversurfer.biberfieber',
  appName: 'Biber Fieber',
  webDir: 'www',
  server: {
    url: "https://biberfieber.floot.app",
    cleartext: false,
    allowNavigation: ["biberfieber.floot.app"]
    // Optional für Offline-Starts: errorPath: "error.html" 
  }
};
export default config;
```

**Konsequenzen:**
- **Login:** Nutzer müssen sich nach dem Update einmalig neu anmelden (Session-Cookie zieht von `localhost` auf `biberfieber.floot.app` um).
- **Apple Review:** Apple prüft bei Remote-Bundles (Guideline 4.2) oft genauer, ob die App nur eine Webseite ist. Da wir Push-Benachrichtigungen, Statusbar, echte Lieferlogistik, Accounts und Zahlungen haben, ist dies argumentierbar.
- Im Floot-Backend muss **kein** Code geändert werden.

## 7. Verifikation nach der Installation

Ob alles funktioniert hat, lässt sich auf dem fertigen Gerät sofort logisch beweisen, ohne den Code zu raten:

1. Öffne die fertig gebaute App.
2. Gehe zu **Mein Konto** → **Guthaben**.
3. Tippe auf einen Aufladen-Betrag. Der Zahlungs-Dialog öffnet sich.
4. **Im Hintergrund passiert folgendes:** Das Frontend feuert ein Diagnostik-Beacon an `/_api/diagnostics/client-error` auf der Live-Domain.
5. In den Produktions-Logs bei Floot erscheint das Event. Es enthält die Plattform, die aktuelle App-Origin (`https://biberfieber.floot.app` oder `capacitor://localhost`), etwaige Apple/Google Pay Fehlerstrings und die Liste `capacitorPlugins`.
6. **Erfolg bedeutet:** 
   - Das neue (gefixte absolute-URL) Beacon zeigt glasklar die Ursache: 
     - Wenn `capacitorPlugins` `"Stripe"` enthält, aber `applePayError` gefüllt ist: Es liegt am Entitlement, dem Provisioning Profile oder der Merchant ID.
     - Wenn `"Stripe"` fehlt: Das Plugin hat es nicht in das native Binary geschafft.
   - Wenn alles klappt: Die Variable `pluginAvailable` steht auf `true` und in der App wird der **echte Apple Pay bzw. Google Pay Button** angezeigt, nicht mehr der Ausweich-Button "Apple / Google Pay im Browser öffnen".

## 8. Reihenfolge / Checkliste

- [ ] Capacitor-Core auf v8 prüfen/updaten
- [ ] Stripe Capacitor-Plugin `@capacitor-community/stripe` installieren
- [ ] `cap sync` für iOS und Android ausführen
- [ ] Android: `minSdkVersion` auf >= 24 stellen
- [ ] iOS: Apple Pay Capability in Xcode hinzufügen & Merchant ID anklicken
- [ ] `capacitor.config.ts` auf Remote-Bundle (`server.url`) umstellen
- [ ] Build für iOS via Codemagic bauen & TestFlight prüfen
- [ ] Build für Android via Codemagic bauen
- [ ] App Store Connect / Play Console Release einreichen