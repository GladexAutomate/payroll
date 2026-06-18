// Detects whether the running frontend is the live PUBLISHED app or the in-editor PREVIEW.
//
// Published apps run on their own domain (e.g. custom domain or *.base44.app).
// The Base44 editor preview runs inside the builder under base44.com / *.base44.dev
// (typically in an iframe). We treat anything that is clearly the editor/preview host
// as "preview", and everything else as "published".
//
// This is sent to backend functions so they can target the Supabase TEST branch in
// preview and the PRODUCTION branch when published.
export function getAppEnv() {
  try {
    const host = (window.location.hostname || '').toLowerCase();
    const inIframe = window.self !== window.top;
    const isEditorHost =
      host.includes('base44.com') ||
      host.includes('base44.dev') ||
      host === 'localhost' ||
      host.startsWith('127.') ||
      host.endsWith('.preview.base44.app');

    // In-editor preview is always framed by the builder; a published app opened
    // directly is not. Treat editor host OR framed editor session as preview.
    if (isEditorHost || (inIframe && !host.endsWith('.base44.app'))) return 'preview';
    return 'published';
  } catch {
    // If we can't tell, fail safe to production.
    return 'published';
  }
}

// True only when we are confident this is the in-editor preview.
export function isPreview() {
  return getAppEnv() === 'preview';
}