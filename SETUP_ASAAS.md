# Configuração da Integração Asaas + CRM

A integração está configurada no código. Siga os passos abaixo para ativar.

## 1. Variáveis de Ambiente

Crie ou edite o arquivo `.env` (ou configure no painel da Vercel) com as seguintes chaves:

```env
# Sua chave de API Asaas (Cuidado: chaves "prod" cobram de verdade!)
ASAAS_API_KEY="$aact_prod_..."

# URL do Supabase e Chave de Serviço
NEXT_PUBLIC_SUPABASE_URL="sua-url-do-supabase"
SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role"

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID="se-sid"
TWILIO_AUTH_TOKEN="seu-token"
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"

# Groq (IA)
GROQ_API_KEY="sua-chave-groq"
```

## 2. Configurar o Webhook no Asaas

Para que o Asaas avise o seu sistema quando um pagamento vencer, você precisa configurar o Webhook.

1. Acesse sua conta Asaas: [Configurações > Integrações > Webhooks](https://www.asaas.com/configuracoes/integracao)
2. Clique em **Criar Webhook**.
3. **Nome**: CRM Integração (Opcional)
4. **URL**: A URL onde seu projeto foi publicado + `/api/webhook/asaas`
   * Exemplo: `https://seu-projeto-crm.vercel.app/api/webhook/asaas`
5. **Eventos**: Selecione (marque a caixa):
   * `Cobranças` -> `Vencimento de cobrança` (PAYMENT_OVERDUE)
   * `Cobranças` -> `Criação de nova cobrança` (PAYMENT_CREATED) - Opcional, se quiser avisar quando gera o boleto.
6. **Salvar**.

## 3. Testando

1. Crie uma cobrança de teste no Asaas (valor baixo, ex R$ 5,00) para um cliente que tenha seu número de WhatsApp.
2. Aguarde o evento (ou force o vencimento se estiver em ambiente de Sandbox).
3. Verifique se o WhatsApp chegou!

## Arquitetura Implementada

* **`lib/asaas.ts`**: Funções para criar clientes e cobranças Pix.
* **`lib/groq-ai.ts`**: Função `generateBillingMessage` que cria textos amigáveis.
* **`app/api/webhook/asaas/route.ts`**: Recebe o aviso do Asaas, consulta o cliente, gera o texto com IA e envia via Twilio.
