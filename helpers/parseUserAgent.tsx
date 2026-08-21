export function parseUserAgent(userAgent: string | null, clientPlatform?: string | null): { 
  deviceLabel: string; 
  deviceType: "mobile" | "tablet" | "desktop" | "unknown"; 
  os: string | null; 
  browser: string | null; 
  isApp: boolean 
} {
  if (!userAgent) {
    return {
      deviceLabel: "Unbekannt",
      deviceType: "unknown",
      os: null,
      browser: null,
      isApp: clientPlatform === "ios-app" || clientPlatform === "android-app"
    };
  }

  let os: string | null = null;
  let deviceType: "mobile" | "tablet" | "desktop" | "unknown" = "unknown";
  let browser: string | null = null;
  let isApp = clientPlatform === "ios-app" || clientPlatform === "android-app";

  const ua = userAgent;

  // OS & Device Type detection
  if (ua.includes("Windows")) {
    os = "Windows";
    deviceType = "desktop";
    const match = ua.match(/Windows NT (\d+\.\d+)/);
    if (match) os = `Windows ${match[1]}`;
  } else if (ua.includes("Mac OS X")) {
    if (ua.includes("iPhone")) {
      os = "iOS";
      deviceType = "mobile";
      const match = ua.match(/OS (\d+[._]\d+)/);
      if (match) os = `iOS ${match[1].replace(/_/g, '.')}`;
    } else if (ua.includes("iPad")) {
      os = "iOS";
      deviceType = "tablet";
      const match = ua.match(/OS (\d+[._]\d+)/);
      if (match) os = `iOS ${match[1].replace(/_/g, '.')}`;
    } else {
      os = "macOS";
      deviceType = "desktop";
      const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
      if (match) os = `macOS ${match[1].replace(/_/g, '.')}`;
    }
  } else if (ua.includes("Android")) {
    os = "Android";
    deviceType = "mobile"; 
    // Basic heuristic: if Android but doesn't mention Mobile, it's often a tablet
    if (!ua.includes("Mobile")) deviceType = "tablet";
    const match = ua.match(/Android (\d+(\.\d+)*)/);
    if (match) os = `Android ${match[1]}`;
  } else if (ua.includes("Linux")) {
    os = "Linux";
    deviceType = "desktop";
  }

  // Browser detection (order matters)
  if (ua.includes("Edg/")) {
    browser = "Edge";
  } else if (ua.includes("OPR/") || ua.includes("Opera")) {
    browser = "Opera";
  } else if (ua.includes("SamsungBrowser")) {
    browser = "Samsung Internet";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Chrome") && !ua.includes("Chromium")) {
    browser = "Chrome";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
  }

  // App heuristic
  if (ua.includes("; wv") || (os?.startsWith("iOS") && !ua.includes("Safari/"))) {
    isApp = true;
  }

  const parts: string[] = [];
  
  if (deviceType === "mobile") {
    if (os?.startsWith("iOS")) parts.push("iPhone");
    else if (os?.startsWith("Android")) parts.push("Android-Gerät");
    else parts.push("Smartphone");
  } else if (deviceType === "tablet") {
    if (os?.startsWith("iOS")) parts.push("iPad");
    else parts.push("Tablet");
  } else if (deviceType === "desktop") {
    if (os?.startsWith("Windows")) parts.push("Windows-PC");
    else if (os?.startsWith("macOS")) parts.push("Mac");
    else if (os?.startsWith("Linux")) parts.push("Linux-PC");
    else parts.push("Computer");
  }

  if (os) parts.push(os);
  
  if (isApp) {
    parts.push("App");
  } else if (browser) {
    parts.push(browser);
  }

  let label = "Unbekannt";
  if (parts.length > 0) {
    // Deduplicate array to avoid cases like "iPhone · iOS 17 · App" repeating concepts unnecessarily 
    // but preserving exactly what's distinct
    label = Array.from(new Set(parts)).join(" · ");
  }

  return {
    deviceLabel: label,
    deviceType,
    os,
    browser,
    isApp
  };
}