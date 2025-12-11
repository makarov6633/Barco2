# 🤖 Agente de IA WhatsApp - Caleb's Tour

Sistema completo de atendimento inteligente via WhatsApp usando **Twilio**, **Supabase** e **Groq AI**.

## 🌟 Características

### IA Conversacional Natural
- **Groq LLM** (llama-3.3-70b-versatile) - Respostas em <1 segundo
- **Personalidade brasileira autêntica** - Ana, atendente calorosa e empática
- **Contexto ilimitado** - Lembra toda a conversa
- **Detecção inteligente de intenções** - Entende o que o cliente quer

### Melhores Práticas Implementadas
✅ Tom natural e humano (não robotizado)  
✅ Respostas curtas e objetivas (ideal para WhatsApp)  
✅ Reconhecimento de emoções  
✅ Adaptação ao ritmo do usuário  
✅ Uso estratégico de emojis  
✅ Prompt engineering otimizado  
✅ Gerenciamento de contexto conversacional  

### Funcionalidades
- 🎫 **Reservas automáticas** com fluxo conversacional
- 💬 **Chat natural** - conversa como humano
- 📊 **Detecção de intenção** com IA
- 🔔 **Notificações em tempo real** para a empresa
- 🎟️ **Vouchers profissionais** com CNPJ
- 🚨 **Alertas urgentes** para reclamações
- 📝 **Contexto persistente** no Supabase

## 🚀 Setup

### 1. Configurar Variáveis (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_BUSINESS_WHATSAPP=whatsapp:+5522998249911

# Groq AI
GROQ_API_KEY=your-groq-api-key
```

### 2. Criar Tabelas no Supabase
Acesse seu dashboard do Supabase: https://supabase.com/dashboard

Execute o arquivo: **SUPABASE_SETUP.sql**

### 3. Instalar Dependências
```bash
npm install
```

### 4. Rodar Localmente
```bash
npm run dev
```

### 5. Configurar Webhook do Twilio
Acesse: https://console.twilio.com/

Configure o webhook para:
```
https://seu-dominio.vercel.app/api/webhook/whatsapp
```

## 📁 Arquitetura

```
lib/
├── supabase.ts       # Cliente Supabase + funções de banco
├── groq-ai.ts        # IA conversacional com Groq
├── twilio.ts         # Envio de mensagens WhatsApp
└── agent.ts          # Agente principal (lógica de conversação)

app/api/webhook/whatsapp/
└── route.ts          # Endpoint do webhook Twilio
```

## 🎯 Fluxo de Atendimento

1. **Cliente envia mensagem** → Twilio recebe
2. **Webhook processa** → Detecta intenção com IA
3. **Agente responde** → Groq gera resposta natural
4. **Contexto salvo** → Supabase persiste conversa
5. **Notificação** → Empresa recebe alertas importantes

## 💬 Exemplos de Conversas

### Reserva Natural
```
Cliente: Oi, quero fazer um passeio de barco
Ana: Oi! 😊 Que legal! Pra qual dia você está pensando?

Cliente: Sábado, 4 pessoas
Ana: Show! Só preciso do seu nome completo pra gerar o voucher

Cliente: Maria Silva
Ana: ✅ RESERVA CONFIRMADA!
     🎫 Voucher: CB2X4K9P1Q
     ...
```

### Consulta de Preços
```
Cliente: Quanto custa o mergulho?
Ana: O mergulho com cilindro sai de R$ 250 a R$ 400, dependendo da data 🤿
     Quer reservar?
```

### Reclamação (Alerta Automático)
```
Cliente: Péssimo atendimento!
Ana: 😔 Sinto muito pelo problema! Nossa equipe vai te ligar AGORA.
     
[Empresa recebe notificação urgente automaticamente]
```

## 🧠 IA - Melhores Práticas

### System Prompt
- Define personalidade clara (Ana - brasileira, amigável, empática)
- Instruções de tom e estilo
- Conhecimento da empresa
- Regras de comportamento

### Técnicas de Prompt Engineering
- **Few-shot learning** - Exemplos de boas/más respostas
- **Context management** - Histórico limitado (últimas 8 mensagens)
- **Temperature 0.8** - Equilíbrio entre criatividade e coerência
- **Max tokens 200** - Respostas curtas (WhatsApp)
- **Frequency/Presence penalty** - Evita repetições

### Detecção de Intenção
- IA analisa mensagem e retorna JSON estruturado
- Extrai entidades (nome, data, números)
- Confidence score para decisões

## 🔧 Troubleshooting

### Webhook não funciona
```bash
# Testar endpoint
curl https://seu-dominio.vercel.app/api/webhook/whatsapp
```

### IA não responde
- Verificar GROQ_API_KEY no .env.local
- Verificar logs do console

### Banco de dados
```bash
# Verificar tabelas
curl "https://your-project.supabase.co/rest/v1/passeios?select=nome" \
  -H "apikey: YOUR_ANON_KEY"
```

## 📊 Status do Sistema

Acesse: `https://seu-dominio.vercel.app/api/webhook/whatsapp`

Retorna:
- Status dos serviços (Groq, Supabase, Twilio)
- Funcionalidades ativas
- Versão do agente

## 🎨 Personalização

### Mudar Personalidade
Edite `lib/groq-ai.ts` → `SYSTEM_PROMPT`

### Adicionar Intenções
Edite `lib/groq-ai.ts` → `detectIntentWithAI()`

### Customizar Vouchers
Edite `lib/twilio.ts` → `formatVoucher()`

## 📝 Notas Importantes

- **Contexto é salvo automaticamente** após cada mensagem
- **Histórico limitado a 20 mensagens** para performance
- **Reclamações geram alertas urgentes** para empresa
- **Respostas em <1 segundo** com Groq
- **Tom brasileiro autêntico** - não traduzido

## 🚀 Deploy

### Vercel (Recomendado)
```bash
vercel --prod
```

Configurar variáveis de ambiente no dashboard da Vercel.

---

**Desenvolvido com ❤️ seguindo as melhores práticas de IA conversacional**
