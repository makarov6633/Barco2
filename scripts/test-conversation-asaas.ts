import dotenv from 'dotenv';

dotenv.config({ path: '/project/workspace/.env.local', override: true });
dotenv.config({ path: '/project/workspace/makarov6633/Barco2/.env.local', override: true });

process.env.TWILIO_DISABLE = 'true';

import { processMessage } from '../lib/agent';

type Step = {
  user: string;
  expect?: (reply: string) => void;
};

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function containsAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function redactPaymentArtifacts(text: string) {
  return text
    .replace(/(\$aact_[A-Za-z0-9_:\-\.]+)(\s*)/g, '[REDACTED_TOKEN]$2')
    .replace(/(Copia e cola:\s*)(.+)/gi, '$1[REDACTED_PIX_PAYLOAD]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
}

async function runScenario(name: string, telefone: string, steps: Step[]) {
  console.log(`\n=== ${name} (${telefone}) ===\n`);
  for (const [idx, step] of steps.entries()) {
    const replyRaw = await processMessage(telefone, step.user);
    const reply = redactPaymentArtifacts(replyRaw);
    console.log(`U${idx + 1}: ${step.user}`);
    console.log(`A${idx + 1}: ${reply}\n`);
    step.expect?.(replyRaw);
  }
}

async function main() {
  assert(!!process.env.ASAAS_API_KEY, 'ASAAS_API_KEY não está definido no ambiente do processo');

  const base = `+55988888${Math.floor(1000 + Math.random() * 8999)}`;

  await runScenario('Reserva + Pagamento PIX (Asaas)', `${base}01`, [
    {
      user: 'Oi! Quero reservar um passeio de quadriciclo',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data']), 'Esperava pergunta de data');
      }
    },
    {
      user: 'Amanhã',
      expect: (reply) => {
        assert(containsAny(reply, ['quantas pessoas', 'pessoas']), 'Esperava pergunta de pessoas');
      }
    },
    {
      user: '2',
      expect: (reply) => {
        assert(containsAny(reply, ['nome completo', 'seu nome']), 'Esperava pergunta do nome');
      }
    },
    {
      user: 'João da Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['pix', 'boleto', '1) pix', '2) boleto']), 'Esperava escolha pix/boleto');
      }
    },
    {
      user: 'pix',
      expect: (reply) => {
        assert(containsAny(reply, ['cpf']), 'Esperava pedir CPF para gerar Pix');
      }
    },
    {
      user: '11144477735',
      expect: (reply) => {
        assert(containsAny(reply, ['voucher']), 'Esperava voucher no final');
        assert(containsAny(reply, ['pix']), 'Esperava instrução de Pix');
      }
    }
  ]);

  await runScenario('Reserva + Pagamento BOLETO (Asaas)', `${base}02`, [
    {
      user: 'Quero reservar um passeio de barco com toboágua',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data']), 'Esperava pergunta de data');
      }
    },
    {
      user: 'Amanhã',
      expect: (reply) => {
        assert(containsAny(reply, ['quantas pessoas', 'pessoas']), 'Esperava pergunta de pessoas');
      }
    },
    {
      user: '2 pessoas',
      expect: (reply) => {
        assert(containsAny(reply, ['nome completo', 'seu nome']), 'Esperava pergunta do nome');
      }
    },
    {
      user: 'Maria Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['pix', 'boleto', '1) pix', '2) boleto']), 'Esperava escolha pix/boleto');
      }
    },
    {
      user: 'boleto',
      expect: (reply) => {
        assert(containsAny(reply, ['cpf']), 'Esperava pedir CPF');
      }
    },
    {
      user: '11144477735',
      expect: (reply) => {
        assert(containsAny(reply, ['e-mail', 'email']), 'Esperava pedir e-mail');
      }
    },
    {
      user: 'teste+asaas@calebstour.com',
      expect: (reply) => {
        assert(containsAny(reply, ['voucher']), 'Esperava voucher no final');
        assert(containsAny(reply, ['boleto']), 'Esperava instrução de boleto');
      }
    }
  ]);

  console.log('\n✅ Cenários Asaas finalizaram sem erro.');
}

main().catch((err) => {
  console.error('\n❌ Falha nos testes Asaas:', err?.message || err);
  process.exit(1);
});
