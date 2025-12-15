import { NextRequest, NextResponse } from 'next/server';
import { listReservas } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/twilio';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getAdminToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7) : undefined;
  return (
    req.headers.get('x-admin-token') ||
    bearer ||
    new URL(req.url).searchParams.get('token') ||
    undefined
  );
}

function isAuthorized(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = getAdminToken(req);
  return !!provided && provided === expected;
}

function currencyBR(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

function buildSummaryMessage(params: { date: string; rows: any[]; passeioId?: string }) {
  const { date, rows } = params;

  const total = rows.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0);

  const header = `📋 Reservas CONFIRMADAS\n📅 ${date}\n✅ ${rows.length} reserva(s)\n💰 Total: R$ ${currencyBR(total)}\n`;

  if (!rows.length) {
    return `${header}\nSem reservas confirmadas para hoje.`;
  }

  const lines = rows.slice(0, 40).map((r: any, i: number) => {
    const nome = r?.cliente?.nome || 'Cliente';
    const tel = r?.cliente?.telefone || '';
    const passeio = r?.passeio?.nome || 'Passeio';
    const qtd = r?.num_pessoas;
    const voucher = r?.voucher;
    const valor = Number(r?.valor_total) || 0;
    return `${i + 1}) ${passeio} — ${nome} (${qtd}p) — R$ ${currencyBR(valor)} — ${voucher}${tel ? ` — ${tel}` : ''}`;
  });

  return `${header}\n${lines.join('\n')}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get('date') || undefined;
    const status = (url.searchParams.get('status') || 'CONFIRMADO') as any;
    const passeioId = url.searchParams.get('passeio_id') || undefined;
    const telefone = url.searchParams.get('telefone') || undefined;

    const rows = await listReservas({ date, status, passeioId, telefone });

    return NextResponse.json({ ok: true, count: rows.length, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const date = typeof body?.date === 'string' ? body.date : undefined;
    const passeioId = typeof body?.passeio_id === 'string' ? body.passeio_id : undefined;

    const dateResolved = typeof date === 'string' && date.trim() ? date.trim() : undefined;
    const rows = await listReservas({ date: dateResolved, status: 'CONFIRMADO', passeioId });
    const resolved = rows[0]?.data_passeio || dateResolved || '';
    const msg = buildSummaryMessage({ date: resolved, rows, passeioId });

    const to = process.env.TWILIO_BUSINESS_WHATSAPP;
    if (!to) {
      return NextResponse.json({ ok: false, error: 'TWILIO_BUSINESS_WHATSAPP not configured' }, { status: 500 });
    }

    const sent = await sendWhatsAppMessage(to, msg);

    return NextResponse.json({ ok: true, sent, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
