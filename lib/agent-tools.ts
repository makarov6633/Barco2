import {
  ConversationContext,
  createCobranca,
  createReserva,
  generateVoucherCode,
  getAllPasseios,
  getClienteById,
  getOrCreateCliente,
  getPasseioById,
  getPendingCobrancaByReservaId,
  getReservaById
} from './supabase';
import {
  createBoletoPayment,
  createPixPayment,
  findOrCreateCustomer
} from './asaas';

export type ToolName =
  | 'consultar_passeios'
  | 'buscar_passeio_especifico'
  | 'criar_reserva'
  | 'gerar_pagamento'
  | 'gerar_voucher';

export type ToolResult =
  | { success: true; data: any }
  | { success: false; error: { message: string; code?: string; missing?: string[]; details?: any } };

export function getToolsForPrompt() {
  return [
    {
      name: 'consultar_passeios',
      description: 'Busca passeios cadastrados no banco (Supabase) com preços, duração, descrição e id.',
      params: { termo: 'string opcional para filtrar por nome/categoria/local' }
    },
    {
      name: 'buscar_passeio_especifico',
      description: 'Busca um passeio específico por nome/categoria e retorna as melhores correspondências.',
      params: { termo: 'string (obrigatório)' }
    },
    {
      name: 'criar_reserva',
      description: 'Cria uma reserva no Supabase quando tiver nome, passeio e data e número de pessoas.',
      params: {
        nome: 'string (obrigatório)',
        passeio_id: 'uuid (recomendado) ou passeio (string) para buscar',
        passeio: 'string (alternativo ao passeio_id)',
        data: 'string (YYYY-MM-DD ou dd/mm)',
        num_pessoas: 'number'
      }
    },
    {
      name: 'gerar_pagamento',
      description: 'Gera cobrança no Asaas (PIX ou BOLETO) e salva referência no Supabase.',
      params: {
        reserva_id: 'uuid',
        tipo_pagamento: '"PIX" | "BOLETO" (opcional; padrão PIX)',
        cpf: 'string opcional',
        email: 'string opcional'
      }
    },
    {
      name: 'gerar_voucher',
      description: 'Gera o texto do voucher para uma reserva confirmada.',
      params: { reserva_id: 'uuid' }
    }
  ] as const;
}

function normalizeString(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBrazilTodayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;

  if (!y || !m || !d) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return `${y}-${m}-${d}`;
}

function addDaysISO(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeDateToISO(input?: string) {
  const raw = (input || '').trim();
  if (!raw) return undefined;

  const lower = normalizeString(raw);
  const today = getBrazilTodayISO();

  if (lower === 'hoje') return today;
  if (lower === 'amanha' || lower === 'amanhã') return addDaysISO(today, 1);
  if (lower === 'depois de amanha' || lower === 'depois de amanhã') return addDaysISO(today, 2);

  const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  const brMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (brMatch) {
    const dd = String(parseInt(brMatch[1], 10)).padStart(2, '0');
    const mm = String(parseInt(brMatch[2], 10)).padStart(2, '0');
    let yyyy = brMatch[3];
    if (!yyyy) {
      yyyy = today.slice(0, 4);
    } else if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  return undefined;
}

function coerceInt(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const m = value.match(/\d+/);
    if (!m) return undefined;
    const n = parseInt(m[0], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function pickPaymentType(params: any): 'PIX' | 'BOLETO' {
  const raw = String(params?.tipo_pagamento ?? params?.tipoPagamento ?? params?.tipo ?? params?.forma_pagamento ?? params?.forma ?? '').toLowerCase();
  if (raw.includes('boleto')) return 'BOLETO';
  if (raw.includes('pix')) return 'PIX';
  return 'PIX';
}

function getMissing(fields: Array<[string, any]>) {
  return fields.filter(([, v]) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v))).map(([k]) => k);
}

function bestPasseioMatches(passeios: any[], term: string) {
  const q = normalizeString(term);
  if (!q) return [];

  const tokens = Array.from(new Set(q.split(' ').filter(t => t.length >= 3)));

  const scored = passeios
    .map(p => {
      const hay = normalizeString(`${p.nome} ${p.categoria || ''} ${p.local || ''} ${p.descricao || ''}`);
      let hits = 0;
      for (const t of tokens) {
        if (hay.includes(t)) hits += 1;
      }
      const exactIdx = hay.indexOf(q);
      const score = hits * 100 + (exactIdx === -1 ? 0 : 50) + (exactIdx === -1 ? 0 : Math.max(0, 30 - exactIdx));
      return { p, score, hits };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.p);

  return scored;
}

function requireSafeToChargeLive() {
  const isProd = process.env.NODE_ENV === 'production';
  const sandboxRaw = String(process.env.ASAAS_SANDBOX ?? '').toLowerCase();
  const sandbox = sandboxRaw === 'true' || sandboxRaw === '1' || sandboxRaw === 'yes';
  if (isProd) return;
  if (!sandbox) {
    throw new Error('Pagamentos em produção bloqueados fora de production (defina ASAAS_SANDBOX=true para testar localmente).');
  }
}

export async function executeTool(name: ToolName, params: any, ctx: { telefone: string; conversation: ConversationContext }): Promise<ToolResult> {
  try {
    if (name === 'consultar_passeios') {
      const termo = typeof params?.termo === 'string' ? params.termo : undefined;
      const passeios = await getAllPasseios();
      const filtered = termo
        ? passeios.filter(p => {
            const hay = normalizeString(`${p.nome} ${p.categoria || ''} ${p.local || ''} ${p.descricao || ''}`);
            const q = normalizeString(termo);
            const tokens = q.split(' ').filter(t => t.length >= 3);
            if (!tokens.length) return hay.includes(q);
            return tokens.every(t => hay.includes(t));
          })
        : passeios;

      return {
        success: true,
        data: filtered.map(p => ({
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          descricao: p.descricao ? String(p.descricao).slice(0, 280) : null,
          local: p.local,
          duracao: p.duracao,
          preco_min: p.preco_min != null ? Number(p.preco_min) : null,
          preco_max: p.preco_max != null ? Number(p.preco_max) : null,
          horarios: p.horarios
        }))
      };
    }

    if (name === 'buscar_passeio_especifico') {
      const termo = typeof params?.termo === 'string' ? params.termo : String(params?.query ?? params?.passeio ?? params?.nome ?? '').trim();
      if (!termo) {
        return { success: false, error: { code: 'missing_term', message: 'Parâmetro termo é obrigatório.', missing: ['termo'] } };
      }

      const passeios = await getAllPasseios();
      const matches = bestPasseioMatches(passeios, termo);

      return {
        success: true,
        data: matches.map(p => ({
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          descricao: p.descricao ? String(p.descricao).slice(0, 280) : null,
          local: p.local,
          duracao: p.duracao,
          preco_min: p.preco_min != null ? Number(p.preco_min) : null,
          preco_max: p.preco_max != null ? Number(p.preco_max) : null,
          horarios: p.horarios
        }))
      };
    }

    if (name === 'criar_reserva') {
      const telefone = ctx.telefone;
      const nome = String(params?.nome ?? ctx.conversation.nome ?? '').trim();
      const passeioId = String(params?.passeio_id ?? params?.passeioId ?? '').trim() || undefined;
      const passeioTerm = String(params?.passeio ?? params?.nome_passeio ?? params?.passeio_nome ?? params?.categoria ?? '').trim() || undefined;
      const dataRaw = String(params?.data ?? params?.data_passeio ?? params?.dia ?? '').trim() || undefined;
      const pessoasRaw = params?.num_pessoas ?? params?.numPessoas ?? params?.pessoas ?? params?.qtd ?? params?.quantidade;
      const numPessoas = coerceInt(pessoasRaw);

      const missing = getMissing([
        ['nome', nome],
        ['data', dataRaw],
        ['num_pessoas', numPessoas],
        ['passeio_id|passeio', passeioId || passeioTerm]
      ]);

      if (missing.length) {
        return { success: false, error: { code: 'missing_fields', message: 'Faltam dados para criar a reserva.', missing } };
      }

      const dataISO = normalizeDateToISO(dataRaw);
      if (!dataISO) {
        return { success: false, error: { code: 'invalid_date', message: 'Data inválida. Use YYYY-MM-DD ou dd/mm.', details: { data: dataRaw } } };
      }

      const passeios = await getAllPasseios();
      let passeio = passeioId ? passeios.find(p => p.id === passeioId) : undefined;
      if (!passeio && passeioId) {
        passeio = (await getPasseioById(passeioId)) || undefined;
      }

      if (!passeio && passeioTerm) {
        const matches = bestPasseioMatches(passeios, passeioTerm);
        if (matches.length === 1) passeio = matches[0];
        if (!passeio && matches.length > 1) {
          return {
            success: false,
            error: {
              code: 'ambiguous_passeio',
              message: 'Encontrei mais de um passeio possível para esse termo.',
              details: {
                termo: passeioTerm,
                sugestoes: matches.map(p => ({ id: p.id, nome: p.nome, categoria: p.categoria, preco_min: p.preco_min != null ? Number(p.preco_min) : null, preco_max: p.preco_max != null ? Number(p.preco_max) : null }))
              }
            }
          };
        }
      }

      if (!passeio) {
        return { success: false, error: { code: 'passeio_not_found', message: 'Passeio não encontrado.', details: { passeio_id: passeioId, passeio: passeioTerm } } };
      }

      const precoMin = passeio.preco_min;
      const precoMax = passeio.preco_max;

      if (precoMin == null && precoMax == null) {
        return { success: false, error: { code: 'price_unknown', message: 'Passeio sem preço cadastrado.', details: { passeio_id: passeio.id } } };
      }

      const valorPorPessoa = precoMin != null ? Number(precoMin) : Number(precoMax);
      const hasRange = precoMin != null && precoMax != null && Number(precoMin) !== Number(precoMax);
      const valorTotal = valorPorPessoa * (numPessoas as number);

      const cliente = await getOrCreateCliente(telefone, nome);
      if (!cliente) {
        return { success: false, error: { code: 'cliente_error', message: 'Erro ao criar/buscar cliente.' } };
      }

      const voucherCode = generateVoucherCode();
      const reserva = await createReserva({
        cliente_id: cliente.id,
        passeio_id: passeio.id,
        data_passeio: dataISO,
        num_pessoas: numPessoas as number,
        voucher: voucherCode,
        status: 'PENDENTE',
        valor_total: valorTotal,
        observacoes: hasRange
          ? `Reserva via WhatsApp | Faixa de preço: R$ ${Number(precoMin).toFixed(2)} - R$ ${Number(precoMax).toFixed(2)}`
          : 'Reserva via WhatsApp'
      });

      if (!reserva?.id) {
        return { success: false, error: { code: 'reserva_error', message: 'Erro ao criar reserva.' } };
      }

      ctx.conversation.nome = nome;
      ctx.conversation.tempData ||= {};
      ctx.conversation.tempData.reservaId = reserva.id;
      ctx.conversation.tempData.valorTotal = valorTotal;
      ctx.conversation.tempData.passeioNome = passeio.nome;
      ctx.conversation.tempData.passeioId = passeio.id;
      ctx.conversation.tempData.data = dataISO;
      ctx.conversation.tempData.numPessoas = numPessoas as number;

      return {
        success: true,
        data: {
          reserva_id: reserva.id,
          voucher_code: voucherCode,
          valor_total: Number(valorTotal.toFixed(2)),
          passeio_nome: passeio.nome,
          passeio_id: passeio.id,
          data: dataISO,
          num_pessoas: numPessoas,
          preco_min: precoMin != null ? Number(precoMin) : null,
          preco_max: precoMax != null ? Number(precoMax) : null,
          valor_por_pessoa: valorPorPessoa,
          requer_confirmacao_valor: hasRange
        }
      };
    }

    if (name === 'gerar_pagamento') {
      requireSafeToChargeLive();

      const reservaId = String(params?.reserva_id ?? params?.reservaId ?? ctx.conversation.tempData?.reservaId ?? '').trim();
      const tipo = pickPaymentType(params);
      const cpf = params?.cpf ? String(params.cpf).trim() : undefined;
      const email = params?.email ? String(params.email).trim() : undefined;

      const missing = getMissing([['reserva_id', reservaId]]);
      if (missing.length) {
        return { success: false, error: { code: 'missing_fields', message: 'Faltam dados para gerar pagamento.', missing } };
      }

      const reserva = await getReservaById(reservaId);
      if (!reserva) {
        return { success: false, error: { code: 'reserva_not_found', message: 'Reserva não encontrada.', details: { reserva_id: reservaId } } };
      }

      const [cliente, passeio] = await Promise.all([
        getClienteById(reserva.cliente_id),
        getPasseioById(reserva.passeio_id)
      ]);

      if (!cliente) {
        return { success: false, error: { code: 'cliente_not_found', message: 'Cliente não encontrado.', details: { cliente_id: reserva.cliente_id } } };
      }

      const precoMin = passeio?.preco_min;
      const precoMax = passeio?.preco_max;
      const hasRange = precoMin != null && precoMax != null && Number(precoMin) !== Number(precoMax);
      if (hasRange) {
        return {
          success: false,
          error: {
            code: 'requires_price_confirmation',
            message: 'Esse passeio tem faixa de preço. Precisa confirmar o valor exato antes de gerar cobrança.',
            details: { preco_min: Number(precoMin), preco_max: Number(precoMax) }
          }
        };
      }

      const valor = Number(reserva.valor_total);
      if (!Number.isFinite(valor) || valor <= 0) {
        return { success: false, error: { code: 'invalid_amount', message: 'Valor da reserva inválido.', details: { valor_total: reserva.valor_total } } };
      }

      if (reserva.status === 'CONFIRMADO') {
        return {
          success: true,
          data: {
            reserva_id: reservaId,
            status: 'CONFIRMADO',
            voucher_code: reserva.voucher,
            message: 'Reserva já está confirmada.'
          }
        };
      }

      const cobrancaExistente = await getPendingCobrancaByReservaId(reservaId, tipo);
      if (cobrancaExistente) {
        return {
          success: true,
          data: {
            reserva_id: reservaId,
            cobranca_id: cobrancaExistente.id,
            asaas_id: cobrancaExistente.asaas_id,
            tipo: cobrancaExistente.tipo,
            valor: cobrancaExistente.valor,
            pix_copiacola: cobrancaExistente.pix_copiacola,
            boleto_url: cobrancaExistente.boleto_url,
            vencimento: cobrancaExistente.vencimento,
            status: cobrancaExistente.status
          }
        };
      }

      const asaasCustomer = await findOrCreateCustomer({
        name: String(params?.nome ?? cliente.nome ?? 'Cliente'),
        cpfCnpj: cpf || cliente.cpf || undefined,
        email: email || cliente.email || undefined,
        phone: cliente.telefone
      });

      const passeioNome = passeio?.nome || 'Passeio';
      const descricao = `${passeioNome} - ${reserva.data_passeio} (${reserva.num_pessoas} pessoa(s))`;

      if (tipo === 'PIX') {
        const { payment, pixQrCode } = await createPixPayment({
          customerId: asaasCustomer.id,
          value: valor,
          description: descricao,
          externalReference: reservaId
        });

        const saved = await createCobranca({
          reserva_id: reservaId,
          cliente_id: cliente.id,
          asaas_id: payment.id,
          tipo: 'PIX',
          valor: valor,
          status: 'PENDENTE',
          pix_qrcode: pixQrCode.encodedImage,
          pix_copiacola: pixQrCode.payload,
          vencimento: pixQrCode.expirationDate
        });

        if (!saved?.id) {
          return { success: false, error: { code: 'cobranca_save_failed', message: 'Erro ao salvar cobrança.' } };
        }

        return {
          success: true,
          data: {
            reserva_id: reservaId,
            cobranca_id: saved.id,
            asaas_id: payment.id,
            tipo: 'PIX',
            valor: valor,
            pix: {
              copia_cola: pixQrCode.payload,
              expiracao: pixQrCode.expirationDate
            }
          }
        };
      }

      const payment = await createBoletoPayment({
        customerId: asaasCustomer.id,
        value: valor,
        description: descricao,
        externalReference: reservaId
      });

      const saved = await createCobranca({
        reserva_id: reservaId,
        cliente_id: cliente.id,
        asaas_id: payment.id,
        tipo: 'BOLETO',
        valor: valor,
        status: 'PENDENTE',
        boleto_url: payment.bankSlipUrl,
        vencimento: payment.dueDate
      });

      if (!saved?.id) {
        return { success: false, error: { code: 'cobranca_save_failed', message: 'Erro ao salvar boleto.' } };
      }

      return {
        success: true,
        data: {
          reserva_id: reservaId,
          cobranca_id: saved.id,
          asaas_id: payment.id,
          tipo: 'BOLETO',
          valor: valor,
          boleto: {
            url: payment.bankSlipUrl,
            vencimento: payment.dueDate
          }
        }
      };
    }

    if (name === 'gerar_voucher') {
      const reservaId = String(params?.reserva_id ?? params?.reservaId ?? ctx.conversation.tempData?.reservaId ?? '').trim();
      if (!reservaId) {
        return { success: false, error: { code: 'missing_fields', message: 'Faltam dados para gerar voucher.', missing: ['reserva_id'] } };
      }

      const reserva = await getReservaById(reservaId);
      if (!reserva) {
        return { success: false, error: { code: 'reserva_not_found', message: 'Reserva não encontrada.', details: { reserva_id: reservaId } } };
      }

      const [cliente, passeio] = await Promise.all([
        getClienteById(reserva.cliente_id),
        getPasseioById(reserva.passeio_id)
      ]);

      if (!cliente) {
        return { success: false, error: { code: 'cliente_not_found', message: 'Cliente não encontrado.' } };
      }

      if (reserva.status !== 'CONFIRMADO') {
        return { success: false, error: { code: 'not_confirmed', message: 'Reserva ainda não está confirmada.', details: { status: reserva.status } } };
      }

      return {
        success: true,
        data: {
          reserva_id: reservaId,
          voucher_code: reserva.voucher,
          cliente_nome: cliente.nome,
          passeio_nome: passeio?.nome || 'Passeio',
          data: reserva.data_passeio,
          horario: '09:00',
          num_pessoas: reserva.num_pessoas,
          valor_total: Number(reserva.valor_total),
          ponto_encontro: passeio?.local || 'Cais da Praia dos Anjos'
        }
      };
    }

    return { success: false, error: { code: 'unknown_tool', message: 'Ferramenta desconhecida.', details: { name } } };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'tool_error',
        message: error?.message ? String(error.message) : 'Erro ao executar ferramenta.',
        details: { name }
      }
    };
  }
}
