# Entscheidungsvorlage: App-Updates ohne Apple-Review ausliefern

Dieses Dokument erläutert, wie Updates für die "Biber Fieber"-App (Capacitor/Floot) an Nutzer ausgeliefert werden können, ohne jedes Mal den Prüfprozess von Apple durchlaufen zu müssen.

## 1. Grundregel: Apple prüft nur Binaries
Apple prüft bei App-Updates ausschließlich **neue Binaries** (die hochgeladene Datei im App Store Connect). Alles, was nicht fest in diese Datei eingebaut ist, kann jederzeit geändert werden, ohne dass ein Review nötig ist.
* **Kein Review nötig:** Interne TestFlight-Tester (sofort verfügbar).
* **Review nötig:** Externe TestFlight-Tester und App-Store-Releases (Dauer in der Regel 24–48 h; ein *Expedited Review* ist nur für echte Notfälle vorgesehen).

## 2. Immer sofort live – ohne Review
Da die App an das Floot-Backend angebunden ist, sind alle Änderungen auf dem Server ohnehin sofort für alle Nutzer sichtbar. Ein neues App-Update ist dafür **nicht** erforderlich:
* Änderungen an der Datenbank (Produkte, Preise, Kategorien, Liefergebiete)
* API-Endpoints
* E-Mail-Templates, Signaturen und PDF-Generierung (Rechnungen, Gutschriften)
* Admin-Einstellungen und Übersetzungen
* Versand von Push-Nachrichten über den Admin-Bereich

## 3. Immer ein neuer Build + Review
Bestimmte grundlegende Änderungen erfordern zwingend einen neuen Build über Codemagic und damit eine Prüfung durch Apple:
* Neue oder aktualisierte Capacitor-Plugins
* Native Berechtigungen und Purpose-Strings (Änderungen an der `Info.plist`)
* App-Icon, Splash-Screen, App-Name und Bundle-ID
* Updates der iOS-Deployment-Target/SDK-Versionen
* Änderungen an der nativen Capacitor-Konfiguration

---

## 4. Die drei Optionen für Frontend-Updates

Wie das Frontend (HTML/CSS/JS der App) aktualisiert wird, hängt von der gewählten Architektur ab. 

*(Wichtiger Hinweis vorab: Ein echter Hybrid-Betrieb – also ein Remote-Bundle, das bei fehlendem Internet automatisch auf ein vollwertiges lokales Bundle zurückfällt – wird von Capacitor nicht unterstützt. Es ist lediglich möglich, eine lokale Fehlerseite via `server.errorPath` anzuzeigen.)*

### Option A – Remote-Bundle
Die App lädt beim Start nicht lokale Dateien, sondern direkt die Web-Ansicht (z. B. `https://biberfieber.floot.app`).
* **Funktionsweise:** In der Capacitor-Config wird die `server.url` auf die Live-Domain gesetzt.
* **Vorteile:** Jedes Floot-Publish ist sofort in der App aktiv. Da die App im Same-Origin-Kontext läuft, entfallen Workarounds für Cookies (CapacitorHttp) und URL-Rewriting im `apiFetchGuard`. Keine Review-Wartezeiten für Frontend-Änderungen. Ein Rollback ist lediglich ein erneutes Publish der Vorversion im Web.
* **Nachteile:** Ohne Netzverbindung startet die App nicht (bzw. zeigt nur die via `server.errorPath` definierte lokale Fehlerseite). Bei der Erstabgabe prüft Apple strenger nach Guideline 4.2 ("minimum functionality"), da die App stark wie eine reine Webseite wirkt. Da es sich aber um einen echten Lieferdienst mit Konto, Bezahlung und Push handelt und native Features (Push, Statusbar, Splash) genutzt werden, ist dies in der Praxis meist unkritisch.
* **Aufwand:** Gering.

### Option B – OTA-Live-Updates
Over-The-Air (OTA) Updates erlauben es, das lokale Bundle im Hintergrund zu aktualisieren.
* **Funktionsweise:** Dienste wie `@capgo/capacitor-updater` (oder Ionic Appflow) laden nur den Web-Code (JS/HTML/CSS) nach. Dies ist von Apple ausdrücklich erlaubt (Apple Developer Program License Agreement §3.3.2), solange sich der Zweck der App nicht ändert.
* **Vorteile:** Die App startet sofort und funktioniert (soweit möglich) offline. Updates können gezielt an bestimmte Nutzergruppen (Kanäle) ausgerollt und bei Fehlern sofort zurückgezogen (Rollback) werden. Keine Review-Wartezeiten für Frontend-Änderungen.
* **Nachteile:** Erfordert ein zusätzliches Plugin (einmaliges Review nötig). Zusätzliche Kosten für den Update-Dienst (oder Self-Hosting). Der Codemagic-Workflow muss erweitert werden, damit er nach jedem Floot-Publish das neue Web-Bundle baut und an den Update-Dienst sendet.
* **Aufwand:** Mittel bis hoch (einmalige Einrichtung).

### Option C – Status quo (Lokales Bundle)
Die klassische Methode, bei der alle Web-Dateien fest in die App eingebaut sind.
* **Funktionsweise:** Keine Remote-URL, kein OTA-Dienst. Die Dateien liegen im App-Binary.
* **Vorteile:** Keine Zusatzdienste, volle Offline-Fähigkeit für den App-Start, geringstes Risiko bei der Apple-Erstabgabe.
* **Nachteile:** Jede noch so kleine Frontend-Änderung (Texte, Farben, Layout) erfordert einen Codemagic-Build, einen Upload zu App Store Connect und ein Apple-Review. Es ist die langsamste Update-Schleife.
* **Aufwand:** Keiner (bereits eingerichtet), aber dauerhaft hoher Zeitaufwand bei Updates.

---

## 5. Vergleichstabelle

| Kriterium | Option A (Remote-Bundle) | Option B (OTA-Updates) | Option C (Lokales Bundle / Status quo) |
| :--- | :--- | :--- | :--- |
| **Review nötig für Frontend-Updates?** | Nein | Nein | Ja |
| **Zeit bis Nutzer das Update sehen** | Sofort (beim nächsten App-Start) | Kurz (meist im Hintergrund nachgeladen) | Tage (abhängig vom Apple-Review) |
| **Offline-Start der App** | Nein (nur Fehlerseite) | Ja | Ja |
| **Zusatzkosten** | Keine | Ja (für OTA-Dienst) | Keine |
| **Einrichtungsaufwand** | Gering | Mittel bis Hoch | Keiner |
| **Risiko bei Erstabgabe (Apple)** | Mittel | Gering | Gering |

---

## 6. Empfehlung

Für diese App ("Biber Fieber") empfehlen wir **Option A (Remote-Bundle)** als den schnellsten und einfachsten Weg.
Da der Lieferdienst für fast alle Funktionen zwingend eine aktive Internetverbindung benötigt (Bestellungen, Produkte laden, API-Calls), ist eine echte Offline-Fähigkeit des Frontends kaum von Nutzen. Option A vereinfacht zudem die Cookie-Verwaltung massiv (Same-Origin) und sorgt dafür, dass Web- und App-Nutzer immer exakt denselben Stand sehen, ohne dass separate Build-Pipelines gepflegt werden müssen.

Sollte ein extrem schneller Start der App (aus dem Cache) und kontrollierte Rollouts wichtiger sein als der Einrichtung- und Pflegeaufwand, ist **Option B (OTA-Live-Updates)** die beste Alternative.

## 7. Nächste Schritte
Sobald eine Entscheidung für Option A oder B getroffen wurde, kann ein konkreter Umsetzungsplan erstellt werden. Dieser umfasst dann die nötigen Anpassungen an der Capacitor-Config bzw. die Integration des OTA-Plugins in den Codemagic-Workflow. Aktuell müssen dafür noch keine Code-Änderungen vorgenommen werden.