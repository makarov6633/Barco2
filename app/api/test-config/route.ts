import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {
      asaas: {
        configured: !!process.env.ASAAS_API_KEY,
        value: process.env.ASAAS_API_KEY ? `${process.env.ASAAS_API_KEY.substring(0, 15)}...` : null
      },
      groq: {
        configured: !!process.env.GROQ_API_KEY,
        value: process.env.GROQ_API_KEY ? `${process.env.GROQ_API_KEY.substring(0, 10)}...` : null
      },
      twilio: {
        accountSid: {
          configured: !!process.env.TWILIO_ACCOUNT_SID,
          value: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...` : null
        },
        authToken: {
          configured: !!process.env.TWILIO_AUTH_TOKEN,
          value: process.env.TWILIO_AUTH_TOKEN ? `${process.env.TWILIO_AUTH_TOKEN.substring(0, 10)}...` : null
        },
        from: {
          configured: !!process.env.TWILIO_WHATSAPP_FROM,
          value: process.env.TWILIO_WHATSAPP_FROM || null
        }
      },
      supabase: {
        url: {
          configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          value: process.env.NEXT_PUBLIC_SUPABASE_URL || null
        },
        serviceKey: {
          configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          value: process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15)}...` : null
        }
      }
    }
  };

  const allConfigured = 
    checks.checks.asaas.configured &&
    checks.checks.groq.configured &&
    checks.checks.twilio.accountSid.configured &&
    checks.checks.twilio.authToken.configured &&
    checks.checks.twilio.from.configured &&
    checks.checks.supabase.url.configured &&
    checks.checks.supabase.serviceKey.configured;

  const missing = [];
  if (!checks.checks.asaas.configured) missing.push('ASAAS_API_KEY');
  if (!checks.checks.groq.configured) missing.push('GROQ_API_KEY');
  if (!checks.checks.twilio.accountSid.configured) missing.push('TWILIO_ACCOUNT_SID');
  if (!checks.checks.twilio.authToken.configured) missing.push('TWILIO_AUTH_TOKEN');
  if (!checks.checks.twilio.from.configured) missing.push('TWILIO_WHATSAPP_FROM');
  if (!checks.checks.supabase.url.configured) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!checks.checks.supabase.serviceKey.configured) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return NextResponse.json({
    status: allConfigured ? '✅ ALL CONFIGURED' : '⚠️ MISSING VARIABLES',
    missing: missing.length > 0 ? missing : null,
    details: checks
  }, { status: allConfigured ? 200 : 500 });
}
