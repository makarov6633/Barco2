# Configuração do Twilio WhatsApp (Passo a Passo)

O Twilio tem um processo de configuração específico para WhatsApp. Aqui está o passo a passo completo.

## 1. Criar Conta no Twilio

1. Acesse: https://www.twilio.com/try-twilio
2. Crie uma conta gratuita (ganha $15 de crédito para testes).
3. Verifique seu e-mail e telefone.

## 2. Ativar o WhatsApp Sandbox

O Twilio tem um "sandbox" (ambiente de testes) para WhatsApp que é **gratuito e imediato**.

1. Acesse: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Você vai ver uma mensagem tipo:
   ```
   join [seu-codigo-unico]
   ```
   Exemplo: `join yellow-tiger`

3. **No seu celular:**
   - Abra o WhatsApp.
   - Mande essa mensagem `join yellow-tiger` para o número do Twilio: **+1 415 523 8886**
   - Aguarde a resposta automática: *"Twilio Sandbox: ✅ You are all set!"*

⚠️ **IMPORTANTE:** Só números que fizeram esse processo podem **receber** mensagens do sandbox.

## 3. Pegar as Credenciais

1. Acesse: https://console.twilio.com/
2. No Dashboard principal, copie:
   - **Account SID** (começa com `AC...`)
   - **Auth Token** (clique no ícone de olho para revelar)

## 4. Configurar no Projeto

Adicione essas variáveis ao seu `.env` local **ou** na Vercel:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_auth_token_aqui
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

⚠️ O número `+14155238886` é o número oficial do Sandbox do Twilio. **Não mude**.

## 5. Testar Localmente

No terminal, dentro da pasta do projeto:

```bash
node test-twilio.js whatsapp:+5522999887766
```

Substitua `+5522999887766` pelo **seu número** (com código do país, DDD e número completo).

**Formato obrigatório:** `whatsapp:+[país][DDD][número]`

Exemplo Brasil:
- ✅ `whatsapp:+5522998247766`
- ❌ `22998247766`
- ❌ `+5522998247766` (sem o `whatsapp:`)

## 6. Erros Comuns

### Erro 21608: "The number is not a valid WhatsApp number"
**Causa:** O número não fez o `join yellow-tiger` no WhatsApp.
**Solução:** Repita o Passo 2.

### Erro 20003: "Authenticate"
**Causa:** As credenciais estão erradas.
**Solução:** Verifique o Account SID e Auth Token.

### Erro 21614: "To number is not a valid mobile number"
**Causa:** Formato incorreto do número.
**Solução:** Use `whatsapp:+5522999999999` (com `whatsapp:` na frente).

## 7. Produção (Conta Paga)

Para enviar para **qualquer número** sem o `join`, você precisa:

1. Fazer upgrade da conta Twilio (adicionar cartão de crédito).
2. Solicitar um **Número WhatsApp Business** aprovado pelo Meta (demora 1-2 semanas).
3. Configurar templates de mensagens aprovados.

**Custo:** ~$0.005 por mensagem (meio centavo de dólar).

---

## 8. Alternativa: Usar Evolution API (Self-Hosted)

Se o Twilio estiver muito caro ou burocrático, você pode usar a **Evolution API** (código aberto) que conecta direto no WhatsApp Web:

- GitHub: https://github.com/EvolutionAPI/evolution-api
- Custo: $0 (você hospeda)
- Desvantagem: Pode ser banido pelo WhatsApp se enviar spam.

Se quiser essa opção, me avise que eu implemento.
