# Integração Completa - Caleb's Tour Agent

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Twilio    │────▶│   Agent     │────▶│   Supabase  │
│  WhatsApp   │◀────│   (Groq)    │◀────│  Knowledge  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Asaas    │
                    │  Pagamentos │
                    └─────────────┘
```

## Componentes

### 1. Supabase (Banco de Dados)
- **knowledge_chunks**: Base de conhecimento do agente (preços, passeios, FAQs)
- **clientes**: Cadastro de clientes
- **passeios**: Catálogo de passeios
- **reservas**: Reservas com status de pagamento
- **conversation_contexts**: Contexto de conversas

### 2. Groq AI (Inteligência)
- Modelo: `llama-3.3-70b-versatile` (ou configurável via env)
- Busca semântica nos knowledge_chunks
- Detecção de intenção e entidades
- Personalidade "Ana" - atendente virtual

### 3. Twilio (Comunicação)
- Recebe mensagens WhatsApp
- Envia respostas e vouchers
- Notifica a empresa de novas reservas

### 4. Asaas (Pagamentos)
- Gera PIX instantâneo
- Gera Boleto bancário
- Webhook para confirmação de pagamento
- Voucher automático após pagamento

## Fluxo de Pagamento

1. Cliente solicita reserva via WhatsApp
2. Agent coleta: passeio, data, pessoas, nome, CPF
3. Agent pergunta forma de pagamento (PIX ou Boleto)
4. Sistema gera cobrança no Asaas
5. Cliente recebe link/código para pagamento
6. Asaas confirma pagamento via webhook
7. Sistema envia voucher automaticamente

## Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Groq
GROQ_API_KEY=
GROQ_REASONING_MODEL=llama-3.3-70b-versatile

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_BUSINESS_WHATSAPP=whatsapp:+5522998249911

# Asaas
ASAAS_API_KEY=
ASAAS_API_URL=https://api.asaas.com/v3
```

## Webhooks

### WhatsApp (Twilio)
- URL: `https://seu-dominio.vercel.app/api/webhook/whatsapp`
- Método: POST
- Configure no Twilio Console

### Pagamentos (Asaas)
- URL: `https://seu-dominio.vercel.app/api/webhook/asaas`
- Método: POST
- Configure em: Asaas > Integrações > Webhooks

## Knowledge Base (Supabase)

A tabela `knowledge_chunks` deve conter informações sobre:
- Preços dos passeios
- Horários e roteiros
- Perguntas frequentes (FAQs)
- Políticas de cancelamento
- Informações da empresa

### Estrutura:
```sql
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Exemplo de conteúdo:
```sql
INSERT INTO knowledge_chunks (slug, title, content, category) VALUES
('preco-barco-arraial', 'Preço Passeio de Barco Arraial', 
 'O Passeio de Barco em Arraial do Cabo custa:
 - Adulto: R$ 150,00 a R$ 200,00
 - Criança (6-10 anos): R$ 100,00
 - Criança até 5 anos: Grátis
 
 Incluso: Água liberada, guia, coletes.
 Taxa de embarque: R$ 10,00 (paga no local)',
 'precos');
```

## Testando

### Status do Agent
```
GET /api/webhook/whatsapp
```

### Status do Webhook Asaas
```
GET /api/webhook/asaas
```

## Personalização

### Modelo de IA
Configure `GROQ_REASONING_MODEL` para usar diferentes modelos:
- `llama-3.3-70b-versatile` (recomendado)
- `mixtral-8x7b-32768`
- `llama-3.1-70b-versatile`

### Personalidade do Agent
Edite o prompt em `lib/groq-ai.ts` na função `buildDynamicSystemPrompt()`
