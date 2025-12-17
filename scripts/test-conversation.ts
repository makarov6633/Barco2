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
  if (!condition) {
    throw new Error(message);
  }
}

function containsAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function containsAll(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.every((n) => lower.includes(n.toLowerCase()));
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

  await runScenario('Negação - barco vs buggy', `${base}00`, [
    {
      user: 'quero passeio de barco e nao buggy',
      expect: (reply) => {
        assert(!containsAny(reply, ['opções de buggy', 'opcoes de buggy']), 'Não deveria oferecer buggy quando o cliente disse "não buggy"');
      }
    },
    {
      user: 'barco',
      expect: (reply) => {
        assert(containsAny(reply, ['passeios disponiveis', 'responda o numero', '1)']), 'Esperava menu de passeios');
      }
    },
    {
      user: '4',
      expect: (reply) => {
        assert(!containsAny(reply, ['opções de buggy', 'opcoes de buggy', 'buggy exclusivo']), 'Não deveria cair para buggy ao escolher número');
      }
    }
  ]);

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
        assert(
          containsAny(reply, ['data', 'qual', '1', 'opção', 'opcao']),
          'Esperava que o agente avançasse (perguntando data ou oferecendo opções)'
        );
      }
    },
    {
      user: '1',
      expect: (reply) => {
        assert(containsAny(reply, ['nome']), 'Esperava pergunta do nome');
      }
    },
    {
      user: 'João da Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data', 'quando']), 'Esperava pergunta de data');
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
        assert(containsAny(reply, ['voucher', 'reserva']), 'Esperava voucher/reserva na resposta final');
      }
    }
  ]);

  await runScenario('Reserva - seleção por número', `${base}03`, [
    {
      user: 'Quero reservar',
      expect: (reply) => {
        assert(containsAny(reply, ['1', '2']), 'Esperava lista com opções numeradas');
      }
    },
    {
      user: '1',
      expect: (reply) => {
        assert(containsAny(reply, ['nome']), 'Esperava pergunta do nome');
      }
    },
    {
      user: 'Maria Silva',
      expect: (reply) => {
        assert(containsAny(reply, ['qual dia', 'pra qual dia', 'data', 'quando']), 'Esperava pergunta de data');
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
