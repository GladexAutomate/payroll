import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// File handling for employee records: sign download links for stored private files,
// and re-host files uploaded from the edit form into Base44 private storage.
//
// NOTE: Airtable file extraction has been removed. The Base44 database is the sole
// source of truth — files now only ever come from in-app uploads.

// Best-effort MIME type so PDFs are stored + served correctly (viewable inline).
function resolveType(file, blobType) {
  const name = String(file.filename || '').toLowerCase();
  if (file.type) return file.type;
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return blobType || 'application/octet-stream';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── SIGN URL: create a temporary download link for a stored private file ────
    if (action === 'signUrl') {
      const { fileUri } = body;
      if (!fileUri) return Response.json({ error: 'fileUri required' }, { status: 400 });
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
      const signedUrl = signed?.signed_url || signed?.data?.signed_url;
      return Response.json({ signedUrl });
    }

    // ── UPLOAD FILES: re-host files dragged/uploaded from the edit form ─────────
    // Receives an array of { filename, type, dataUrl(base64) }, stores each in
    // private storage, and returns [{ filename, file_uri, type }] to merge into
    // the record's file field.
    if (action === 'uploadFiles') {
      const incoming = Array.isArray(body.files) ? body.files : [];
      if (incoming.length === 0) return Response.json({ error: 'No files provided' }, { status: 400 });

      const stored = [];
      for (const f of incoming) {
        const base64 = String(f.dataUrl || '').split(',').pop();
        if (!base64) continue;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const name = f.filename || 'document';
        const type = f.type || resolveType({ filename: name }, '');
        const file = new File([bytes], name, { type });
        const uploaded = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
        const fileUri = uploaded?.file_uri || uploaded?.data?.file_uri;
        if (fileUri) stored.push({ filename: name, file_uri: fileUri, type });
      }
      return Response.json({ files: stored });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
