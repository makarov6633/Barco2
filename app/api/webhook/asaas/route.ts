import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/asaas';
import { generateBillingMessage } from '@/lib/groq-ai';
import { sendWhatsAppMessage } from '@/lib/twilio';
import { getConversationContext, saveConversationContext } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, payment } = body;

    console.log(`📡 Asaas Webhook: ${event}`, payment?.id);

    if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_CREATED') {
       if (!payment || !payment.customer) {
         return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
       }

       // 1. Get Customer Details
       const customer = await getCustomer(payment.customer);

       const phone = customer.mobilePhone ?? customer.phone;
       if (!phone) {
         console.log('⚠️ Customer has no phone:', customer.id);
         return NextResponse.json({ success: false, message: 'No phone number' });
       }

       // 2. Generate Message
       const isLate = event === 'PAYMENT_OVERDUE';
       const message = await generateBillingMessage(
         customer.name, 
         payment.description || 'Passeio', 
         payment.invoiceUrl, 
         isLate
       );

       // 3. Send WhatsApp
       const sent = await sendWhatsAppMessage(phone, message);
       
       if (sent) {
         console.log(`✅ Message sent to ${customer.name} (${phone})`);
         
         // 4. Log to Supabase History
         try {
             // Normalized phone format handling might be needed depending on DB, 
             // but usually Twilio/Asaas share similar formats (E.164 or plain)
             // Asaas usually sends raw (e.g., 2299887766), we might need to query carefully.
             // lib/supabase.ts doesn't normalize, so we assume exact match or just save what we have.
             
             const context = await getConversationContext(phone);
             context.conversationHistory.push({
                 role: 'assistant',
                 content: `[SISTEMA DE COBRANÇA]: ${message}`
             });
             await saveConversationContext(context);
             console.log('✅ Interaction logged to Supabase');
         } catch (dbError) {
             console.error('⚠️ Failed to log to Supabase:', dbError);
             // Non-blocking error
         }

       } else {
         console.error(`❌ Failed to send to ${customer.name}`);
       }
       
       return NextResponse.json({ success: true, message: 'Processed' });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

