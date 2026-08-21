import { db } from "./db";

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1") return true;
  const parts = ip.split('.');
  if (parts.length === 4) {
    if (parts[0] === "10") return true;
    if (parts[0] === "192" && parts[1] === "168") return true;
    if (parts[0] === "172") {
      const p2 = parseInt(parts[1], 10);
      if (p2 >= 16 && p2 <= 31) return true;
    }
    if (parts[0] === "169" && parts[1] === "254") return true;
  }
  if (ip.toLowerCase().startsWith("fc00:") || ip.toLowerCase().startsWith("fd")) return true;
  return false;
}

export async function lookupIpGeolocations(ipAddresses: string[]) {
  // Extract distinct valid IP strings
  const distinctIps = Array.from(new Set(ipAddresses.filter(Boolean)));
  const results = new Map<
    string,
    { city: string | null; region: string | null; country: string | null; countryCode: string | null; isPrivate: boolean; failed: boolean }
  >();
  
  const publicIps: string[] = [];

  for (const ip of distinctIps) {
    if (isPrivateIp(ip)) {
      results.set(ip, { city: null, region: null, country: null, countryCode: null, isPrivate: true, failed: false });
    } else {
      publicIps.push(ip);
    }
  }

  if (publicIps.length === 0) return results;

  // Database cache lookup for public IPs
  const cached = await db.selectFrom("ipGeolocations")
    .selectAll()
    .where("ipAddress", "in", publicIps)
    .execute();

  const toFetch: string[] = [];
  const now = new Date();

  for (const ip of publicIps) {
    const cache = cached.find(c => c.ipAddress === ip);
    if (cache) {
      if (cache.lookupFailed) {
        // Retry if older than 7 days
        const age = now.getTime() - new Date(cache.updatedAt).getTime();
        if (age > 7 * 24 * 60 * 60 * 1000) {
          toFetch.push(ip);
        } else {
          results.set(ip, { city: null, region: null, country: null, countryCode: null, isPrivate: false, failed: true });
        }
      } else {
        results.set(ip, {
          city: cache.city,
          region: cache.region,
          country: cache.country,
          countryCode: cache.countryCode,
          isPrivate: false,
          failed: false
        });
      }
    } else {
      toFetch.push(ip);
    }
  }

  // Soft limit fetching externally to not block the request for too long (max 25 IPs)
  const fetchSlice = toFetch.slice(0, 25);
  
  // Parallel fetching in small throttled batches
  const batchSize = 5;
  for (let i = 0; i < fetchSlice.length; i += batchSize) {
    const batch = fetchSlice.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ip) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4 sec timeout
        
        const res = await fetch(`https://ipwho.is/${ip}`, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        
        if (data && data.success === true) {
          const lat = data.latitude ? Number(data.latitude) : null;
          const lng = data.longitude ? Number(data.longitude) : null;
          
          await db.insertInto("ipGeolocations")
            .values({
              ipAddress: ip,
              city: data.city || null,
              region: data.region || null,
              country: data.country || null,
              countryCode: data.country_code || null,
              latitude: lat,
              longitude: lng,
              lookupFailed: false,
              updatedAt: new Date()
            })
            .onConflict((oc) => oc.column("ipAddress").doUpdateSet({
              city: data.city || null,
              region: data.region || null,
              country: data.country || null,
              countryCode: data.country_code || null,
              latitude: lat,
              longitude: lng,
              lookupFailed: false,
              updatedAt: new Date()
            }))
            .execute();
            
          results.set(ip, {
            city: data.city || null,
            region: data.region || null,
            country: data.country || null,
            countryCode: data.country_code || null,
            isPrivate: false,
            failed: false
          });
        } else {
          throw new Error("API success false");
        }
      } catch (error) {
        console.error(`Failed to lookup IP geolocation for ${ip}:`, error);
        
        // Cache the failure so we don't spam the API with bad IPs
        await db.insertInto("ipGeolocations")
          .values({
            ipAddress: ip,
            lookupFailed: true,
            updatedAt: new Date()
          })
          .onConflict((oc) => oc.column("ipAddress").doUpdateSet({
            lookupFailed: true,
            updatedAt: new Date()
          }))
          .execute();
          
        results.set(ip, { city: null, region: null, country: null, countryCode: null, isPrivate: false, failed: true });
      }
    }));
  }

  // Treat remainder of toFetch (if > 25) as failed for this particular request 
  // so the endpoint response time isn't excessively prolonged. 
  // They will be picked up on subsequent requests.
  for (let i = 25; i < toFetch.length; i++) {
    results.set(toFetch[i], { city: null, region: null, country: null, countryCode: null, isPrivate: false, failed: true });
  }

  return results;
}