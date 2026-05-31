import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HEX = /^#[0-9a-fA-F]{6}$/;
const safeHex = (v, fallback) => (typeof v === 'string' && HEX.test(v.trim())) ? v.trim().toLowerCase() : fallback;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { logo_url } = await req.json();
    if (!logo_url) return Response.json({ error: 'logo_url is required' }, { status: 400 });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: 'You are a brand designer. Look at this company/branch logo image and extract a professional brand color palette to be used on an official payslip document. Return colors as hex strings. primary_color = the dominant/darkest brand color suitable for a header background. secondary_color = a complementary darker shade for a gradient end. accent_color = a vivid brand accent for small markers and highlights. text_on_primary = either #ffffff or #0f172a, whichever is most readable on top of the primary_color. Keep the palette clean and corporate.',
      file_urls: [logo_url],
      response_json_schema: {
        type: 'object',
        properties: {
          primary_color: { type: 'string' },
          secondary_color: { type: 'string' },
          accent_color: { type: 'string' },
          text_on_primary: { type: 'string' },
        },
        required: ['primary_color', 'secondary_color', 'accent_color', 'text_on_primary'],
      },
    });

    const branding = {
      primary_color: safeHex(result?.primary_color, '#0f172a'),
      secondary_color: safeHex(result?.secondary_color, '#1e3a8a'),
      accent_color: safeHex(result?.accent_color, '#2563eb'),
      text_on_primary: safeHex(result?.text_on_primary, '#ffffff'),
    };

    return Response.json({ success: true, branding });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});