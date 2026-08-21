export function requestClientInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const headers = request.headers;
  
  let ipCandidate = 
    (headers.get("x-forwarded-for") || "").split(',')[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("true-client-ip") ||
    headers.get("x-client-ip") ||
    (() => {
      const forwarded = headers.get("forwarded");
      if (forwarded) {
        const match = forwarded.match(/for="?([^";,]+)"?/);
        return match ? match[1] : null;
      }
      return null;
    })();

  let ipAddress: string | null = null;
  if (ipCandidate && ipCandidate.toLowerCase() !== "unknown") {
    if (ipCandidate.startsWith("::ffff:")) {
      ipCandidate = ipCandidate.substring(7);
    }
    ipAddress = ipCandidate.substring(0, 64);
  }

  let userAgent = headers.get("user-agent");
  if (userAgent) {
    userAgent = userAgent.substring(0, 500);
  }

  return { ipAddress, userAgent: userAgent || null };
}