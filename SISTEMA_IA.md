# Sistema Inteligente Caleb's Tour - Chatbot com IA

## 🎯 Arquitetura Implementada

### **IA Gerencia Tudo - Sem Respostas Mockadas**

O chatbot agora funciona com **IA interpretativa total**:

1. **A IA lê** as mensagens do cliente
2. **A IA interpreta** o contexto e intenção
3. **A IA decide** quais ferramentas usar
4. **A IA responde** naturalmente com base nos dados reais

## 🛠️ Ferramentas Disponíveis para a IA

A IA pode chamar essas ferramentas quando necessário:

### 1. `consultar_passeios`
Busca todos os passeios no banco de dados com preços, durações e descrições reais.

### 2. `buscar_passeio_especifico`
Busca um passeio específico por nome ou categoria.

### 3. `criar_reserva`
Cria uma reserva no Supabase quando tiver todas as informações:
- Telefone do cliente
- Nome completo
- ID do passeio
- Data
- Número de pessoas

### 4. `gerar_pagamento`
Gera pagamento via **Asaas** (PIX ou Boleto):
- Cria/busca cliente no Asaas
- Gera cobrança
- Retorna QR Code PIX ou link de Boleto
- Salva reference da reserva

### 5. `gerar_voucher`
Gera voucher de confirmação após pagamento aprovado.

## 📋 Fluxo Completo

### **Cliente pergunta sobre passeio:**
```
Cliente: "Quero saber o valor do passeio de barco para 2 pessoas"
```

**IA interpreta e responde:**
- Consulta banco de dados via `consultar_passeios`
- Identifica que faltam informações (data, nome)
- Responde naturalmente: "Oi! 😊 O Passeio de Barco com Toboágua custa R$ 59,90 por pessoa..."
- Pergunta: "Para qual dia você quer ir?"

### **Cliente fornece informações:**
```
Cliente: "Amanhã, 2 pessoas. Meu nome é João Silva"
```

**IA coleta dados e cria reserva:**
- Extrai: data (amanhã), número de pessoas (2), nome (João Silva)
- Chama `criar_reserva` com telefone detectado
- Retorna: reserva_id, voucher_code, valor_total

### **Cliente quer pagar:**
```
Cliente: "Gera o PIX para mim"
```

**IA gera pagamento:**
- Chama `gerar_pagamento` com:
  - reserva_id
  - tipo_pagamento: "PIX"
  - dados do cliente
  - valor calculado
- Asaas retorna: QR Code, Copia e Cola
- IA responde: "Aqui está seu PIX! 🚤..."

### **Sistema verifica pagamento:**
- Webhook do Asaas notifica quando pagamento confirmado
- Sistema atualiza status da reserva
- IA chama `gerar_voucher`
- Cliente recebe voucher completo

## 🔗 Integrações

### **Supabase** 
Banco de dados com:
- Passeios (preços reais do concorrente)
- Clientes
- Reservas
- Contextos de conversa

### **Asaas**
Sistema de pagamentos:
- Criação de clientes
- Geração de PIX/Boleto
- Webhooks de confirmação
- Gestão de cobranças

### **Groq AI**
Modelo de linguagem:
- `openai/gpt-oss-120b` para raciocínio
- Interpreta mensagens
- Decide ferramentas
- Gera respostas naturais

### **Twilio**
WhatsApp Business:
- Recebe mensagens
- Envia respostas
- Notifica empresa

## 🎨 Dados Reais

**10 passeios cadastrados** do site concorrente:
1. Passeio de Barco com Toboágua - R$ 59,90
2. Passeio de Barco Open Bar + Open Food - R$ 169,90 - R$ 250,00
3. Quadriciclo Automático - R$ 200,00 - R$ 300,00
4. Buggy Roteiro Tradicional - R$ 250,00 - R$ 300,00
5. Buggy Roteiro Arubinha - R$ 550,00
6. Buggy Exclusivo 7h - R$ 1.200,00
7. Mergulho com Cilindro - R$ 300,00 - R$ 320,00
8. Mergulho de Snorkel - R$ 120,00 - R$ 180,00
9. Combo Barco + Quadriciclo - R$ 300,00 - R$ 450,00
10. City Tour do Rio - R$ 280,00 - R$ 320,00

**Sem mock data!** Tudo vem do banco de dados em tempo real.

## ⚙️ Configuração

### Variáveis de Ambiente (.env.local)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Groq AI
GROQ_API_KEY=...

# Asaas Pagamentos (PRODUÇÃO)
ASAAS_API_KEY=...
ASAAS_SANDBOX=false
```

## 🚀 Como Funciona na Prática

1. **Cliente envia mensagem no WhatsApp**
2. **Twilio webhook** recebe e envia para `/api/webhook/whatsapp`
3. **Agent** processa:
   - Detecta intenção com IA
   - Busca contexto da conversa
   - Consulta passeios no banco
   - Passa tudo para IA com lista de ferramentas
4. **IA decide** se precisa usar ferramenta (formato `[TOOL:nome]{params}[/TOOL]`)
5. **Sistema executa** ferramenta e retorna resultado
6. **IA formula resposta** natural com o resultado
7. **Cliente recebe** resposta humanizada

## 📝 Exemplo Real de Ferramenta

**IA detecta que precisa criar reserva:**
```
[TOOL:criar_reserva]
{
  "telefone": "+5522998249911",
  "nome": "João Silva",
  "passeio_id": "bd2c64ee-8900-48e9-9512-930dc44041ce",
  "data": "2025-12-14",
  "num_pessoas": 2
}
[/TOOL]
```

**Sistema executa e retorna:**
```json
{
  "success": true,
  "data": {
    "reserva_id": "abc-123",
    "voucher_code": "CTG8X2N4",
    "valor_total": 119.80,
    "passeio_nome": "Passeio de Barco com Toboágua"
  }
}
```

**IA recebe e responde:**
```
Show! 🎉 Sua reserva está confirmada!

📋 Código: CTG8X2N4
🚤 Passeio: Barco com Toboágua
💰 Valor: R$ 119,80
👥 2 pessoas

Quer gerar o PIX para pagamento? 😊
```

## ✅ Benefícios

- ✨ **Zero respostas mockadas** - Tudo vem do banco
- 🧠 **IA decide tudo** - Interpreta e age
- 💳 **Pagamento real** - Asaas integrado
- 📊 **Dados reais** - Do site concorrente
- 🔄 **Fluxo completo** - Consulta → Reserva → Pagamento → Voucher
- 🎯 **Natural e humano** - Conversa fluida

## 🔧 Scripts Úteis

### Atualizar passeios no banco
```bash
cd /project/workspace/makarov6633/Barco2
export $(cat .env.local | xargs)
python3 scripts/update-passeios.py
```

### Verificar build
```bash
npm run build
```

### Deploy
```bash
git add -A
git commit -m "feat: integrar Asaas e tools para IA"
git push origin capy/cap-1-65e7b9d0
```
