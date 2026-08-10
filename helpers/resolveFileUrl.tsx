/**
 * Resolves relative /_cdn/ URLs to absolute URLs for the native mobile app context.
 * In native environments, relative paths resolve to localhost which breaks asset loading.
 */
export function resolveFileUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  // In native mobile app, relative /_cdn/ paths resolve to localhost which doesn't work.
  // Convert them to absolute URLs using the published domain.
  if (url.startsWith('/_cdn/') && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'https://biberfieber.floot.app' + url;
  }
  
  return url;
}