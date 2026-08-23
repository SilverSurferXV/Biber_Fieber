import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Biber Fieber – Capacitor Konfiguration (Variante B)
 *
 * Das Web-Bundle wird lokal in der App ausgeliefert (Origin: capacitor://localhost auf iOS,
 * https://localhost auf Android). Damit die App trotzdem das Backend unter
 * https://biberfieber.floot.app erreichen kann, laufen alle HTTP-Requests ueber die
 * native Schicht (CapacitorHttp) und die Cookies werden nativ verwaltet (CapacitorCookies).
 *
 * Ergebnis:
 *  - kein CORS-Problem, weil die Requests nicht mehr aus dem WebView-Origin kommen
 *  - das Session-Cookie (Secure; SameSite=None; HttpOnly) wird korrekt gespeichert & mitgesendet
 *  - Login, Shop, Bestellungen und Bilder funktionieren wie im Browser
 *
 * Das Frontend ruft die API absolut auf: helpers/apiFetchGuard erkennt capacitor://localhost
 * bzw. localhost und leitet alle /_api/... Aufrufe automatisch auf https://biberfieber.floot.app um.
 */
const config: CapacitorConfig = {
  // Muss exakt der Bundle-ID in App Store Connect / Google Play entsprechen
  appId: 'com.silversurfer.biberfieber',
  appName: 'Biber Fieber',

  // Ausgabeordner des Vite-Builds. Bitte einmal pruefen: liegt der Build in "dist",
  // dann so lassen. Liegt er in "build" oder "www", hier entsprechend anpassen.
  webDir: 'dist',

  server: {
    // Android laedt das lokale Bundle unter https://localhost (Standard ab Capacitor 5).
    // Wichtig, damit Secure-Cookies auch auf Android akzeptiert werden.
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Kein Klartext-HTTP zulassen
    cleartext: false,
    // KEIN server.url setzen - das Bundle kommt aus der App (Variante B)
  },

  ios: {
    // Standard-WebView-Verhalten; verhindert Layout-Spruenge unter der Notch
    contentInset: 'always',
    // false = WebView darf beliebige Domains ansprechen.
    // Nur auf true setzen, wenn in der Info.plist WKAppBoundDomains gepflegt wird.
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    // Web-Assets werden aus dem App-Bundle geladen
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // >>> Kern der Variante B <<<
    // Patcht window.fetch und XMLHttpRequest, sodass Requests nativ ausgefuehrt werden.
    CapacitorHttp: {
      enabled: true,
    },
    // Verwaltet Cookies (inkl. Session-Cookie) nativ und persistent.
    CapacitorCookies: {
      enabled: true,
    },

    // Optional, aber empfohlen: Splashscreen sauber ausblenden, sobald die App bereit ist.
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: false,
    },

    // Optional: Statusleiste passend zum hellen App-Hintergrund.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },

    // Optional: Tastatur soll das Layout nicht zerschieben.
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
