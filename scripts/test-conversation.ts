import dotenv from 'dotenv';

dotenv.config({ path: '/project/workspace/.env.local' });
dotenv.config({ path: '/project/workspace/makarov6633/Barco2/.env.local' });

process.env.TWILIO_DISABLE = 'true';

import { processMessage } from '../lib/agent';

type Step = {
  user: string;
  expect?: (reply: string) => void;
};

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function containsAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

async function runScenario(name: string, telefone: string, steps: Step[]) {
  console.log(`\n=== ${name} (${telefone}) ===\n`);

  for (const [idx, step] of steps.entries()) {
    const reply = await processMessage(telefone, step.user);
    console.log(`U${idx + 1}: ${step.user}`);
    console.log(`A${idx + 1}: ${reply}\n`);
    if (step.expect) {
      step.expect(reply);
    }
  }
}

async function main() {
  const base = `+55999999${Math.floor(1000 + Math.random() * 8999)}`;

  await runScenario('Preço - quadriciclo', `${base}01`, [
    {
      user: 'Quanto custa quadriciclo?',
      expect: (reply) => {
        assert(containsAny(reply, ['r$']), 'Esperava resposta com R$');
      }
    }
  ]);

  await runScenario('Reserva - fluxo completo (sem Asaas)', `${base}02`, [
    {
      user: 'Oi! Quero reservar um passeio de quadriciclo',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data']), 'Esperava pergunta de data');
      }
    },
    {
      user: 'Amanhã',
      expect: (reply) => {
        assert(containsAny(reply, ['quantas pessoas', 'qntas pessoas', 'pessoas']), 'Esperava pergunta de número de pessoas');
      }
    },
    {
      user: '2 pessoas',
      expect: (reply) => {
        assert(containsAny(reply, ['nome completo', 'seu nome']), 'Esperava pergunta do nome');
      }
    },
    {
      user: 'João da Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['voucher', 'reserva']), 'Esperava voucher/reserva na resposta final');
      }
    }
  ]);

  await runScenario('Reserva - seleção 1/2/3', `${base}03`, [
    {
      user: 'Quero reservar',
      expect: (reply) => {
        assert(containsAny(reply, ['1.', '2.', '3.']), 'Esperava lista com opções 1/2/3');
      }
    },
    {
      user: '1',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data']), 'Esperava pergunta de data após selecionar opção');
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
      user: 'Maria Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['voucher', 'reserva']), 'Esperava voucher/reserva na resposta final');
      }
    }
  ]);

  console.log('\n✅ Cenários básicos finalizaram sem erro.');
}

main().catch((err) => {
  console.error('\n❌ Falha nos testes:', err?.message || err);
  process.exit(1);
});
