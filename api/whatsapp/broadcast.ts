import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelLikeReq = IncomingMessage & { body?: unknown };

interface BroadcastBody {
  recipients?: Array<{ id?: unknown; name?: unknown; phone?: unknown; message?: unknown }>;
  defaultMessage?: unknown;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: VercelLikeReq): Promise<BroadcastBody> {
  if (req.body && typeof req.body === 'object') {
    return req.body as BroadcastBody;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as BroadcastBody;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as BroadcastBody;
}

export default async function handler(req: VercelLikeReq, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: 'Metode tidak diizinkan. Gunakan metode POST ke /api/whatsapp/broadcast.',
    });
    return;
  }

  const token = process.env.WHATSAPP_TOKEN?.trim() || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const provider =
    process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() ||
    (phoneNumberId ? 'meta' : 'fonnte');
  const gatewayUrl =
    process.env.WHATSAPP_GATEWAY_URL?.trim() ||
    (provider === 'wablas'
      ? 'https://solo.wablas.com/api/send-message'
      : 'https://api.fonnte.com/send');

  if (!token) {
    sendJson(res, 503, {
      error:
        'Gateway WhatsApp otomatis belum aktif di server (WHATSAPP_TOKEN belum diatur). Gunakan mode Kirim Langsung via WhatsApp (wa.me) atau atur WHATSAPP_TOKEN di environment server.',
    });
    return;
  }

  let body: BroadcastBody;
  try {
    body = await readRequestBody(req);
  } catch {
    sendJson(res, 400, { error: 'Body permintaan harus berupa JSON yang valid.' });
    return;
  }

  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const defaultMessage = typeof body.defaultMessage === 'string' ? body.defaultMessage.trim() : '';

  if (rawRecipients.length === 0) {
    sendJson(res, 400, { error: 'Daftar penerima WhatsApp kosong.' });
    return;
  }

  if (rawRecipients.length > 200) {
    sendJson(res, 400, { error: 'Maksimal 200 penerima per sekali pengiriman broadcast.' });
    return;
  }

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    let clean = digits;
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.startsWith('8')) clean = '62' + clean;
    return clean.length >= 9 && clean.length <= 15 ? clean : '';
  };

  const results: Array<{
    id: string;
    name: string;
    phone: string;
    ok: boolean;
    detail: string;
  }> = [];

  for (let i = 0; i < rawRecipients.length; i++) {
    const item = rawRecipients[i];
    const recId = typeof item.id === 'string' ? item.id : `rec_${i}`;
    const recName = typeof item.name === 'string' ? item.name.trim() : 'Siswa';
    const rawPhone = typeof item.phone === 'string' ? item.phone : '';
    const phone = normalizePhone(rawPhone);
    const text =
      typeof item.message === 'string' && item.message.trim().length > 0
        ? item.message.trim()
        : defaultMessage;

    if (!phone) {
      results.push({ id: recId, name: recName, phone: rawPhone, ok: false, detail: 'Nomor WA tidak valid' });
      continue;
    }

    if (!text) {
      results.push({ id: recId, name: recName, phone, ok: false, detail: 'Pesan kosong' });
      continue;
    }

    try {
      let gwRes: globalThis.Response;

      if (provider === 'meta' && phoneNumberId) {
        gwRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
          }),
        });
      } else if (provider === 'wablas') {
        gwRes = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone, message: text }),
        });
      } else {
        const form = new URLSearchParams();
        form.append('target', phone);
        form.append('message', text);
        form.append('countryCode', '62');
        gwRes = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            Authorization: token,
          },
          body: form,
        });
      }

      const payload = (await gwRes.json().catch(() => ({}))) as {
        status?: boolean;
        reason?: string;
        message?: string;
        error?: { message?: string };
      };

      const isOk = gwRes.ok && payload.status !== false && !payload.error;
      results.push({
        id: recId,
        name: recName,
        phone,
        ok: isOk,
        detail: isOk
          ? 'Terkirim'
          : payload.error?.message || payload.reason || payload.message || `HTTP ${gwRes.status}`,
      });
    } catch (err) {
      results.push({
        id: recId,
        name: recName,
        phone,
        ok: false,
        detail: err instanceof Error ? err.message : 'Gagal menghubungi gateway',
      });
    }

    if (i < rawRecipients.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  sendJson(res, 200, {
    total: results.length,
    sentCount,
    failedCount: results.length - sentCount,
    results,
  });
}
