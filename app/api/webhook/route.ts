import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import twilio from 'twilio';
import { getPortfolioContent } from '@/lib/api';

// Configuração dos Clientes (Protegido para não quebrar se faltar chave)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const client = process.env.TWILIO_ACCOUNT_SID ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
const MessagingResponse = require('twilio').twiml.MessagingResponse;

export async function POST(req: NextRequest) {
    try {
        // Recebe o corpo da mensagem do Twilio (Form Data)
        const formData = await req.formData();
        const incomingMsg = formData.get('Body') as string;
        const fromNumber = formData.get('From') as string;

        console.log(`📩 Mensagem de ${fromNumber}: ${incomingMsg}`);

        // 1. Carrega o Texto Base
        const knowledgeBase = getPortfolioContent();

        // 2. Define o Prompt do Sistema
        const systemPrompt = `
        Você é o atendente virtual da Caleb's Tour Company (Arraial do Cabo).
        
        FONTE DE DADOS OFICIAL:
        ---
        ${knowledgeBase}
        ---
        
        REGRAS:
        1. Responda curto e direto (estilo WhatsApp).
        2. Use emojis de praia/verão.
        3. Se perguntarem preço, use APENAS os dados do texto acima.
        4. O número para contato humano é (22) 99824-9911.
        5. Seja vendedor: tente fechar a reserva perguntando a data desejada.
        `;

        let aiResponse = "Desculpe, estou em manutenção rápida. Pode chamar no link do perfil?";

        // 3. Chama a OpenAI (Se configurada)
        if (openai && incomingMsg) {
            try {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: incomingMsg }
                    ],
                    model: "gpt-3.5-turbo",
                    temperature: 0.7,
                    max_tokens: 300,
                });
                aiResponse = completion.choices[0].message.content || aiResponse;
            } catch (error) {
                console.error("Erro OpenAI:", error);
                aiResponse = "Oi! Tive um problema técnico. Pode me chamar no contato principal? (22) 99824-9911";
            }
        } else {
             aiResponse = "Olá! O sistema de IA ainda não está com a chave ativada. Mas nossa equipe já vai te atender!";
        }

        // 4. Retorna resposta para o Twilio (TwiML XML)
        const twiml = new MessagingResponse();
        twiml.message(aiResponse);

        return new NextResponse(twiml.toString(), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
        });

    } catch (error) {
        console.error('Erro no Webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
