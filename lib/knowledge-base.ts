export const FAQ_GENERAL = [
  { p: "Onde fica a Caleb's Tour?", r: "Nossa base fica na Travessa Beija-Flor, Jacaré, Cabo Frio - RJ, mas nossos passeios saem principalmente do Cais da Praia dos Anjos em Arraial do Cabo." },
  { p: "Qual o CNPJ?", r: "Nosso CNPJ é 26.096.072/0001-78." },
  { p: "Quais as formas de pagamento?", r: "Aceitamos PIX, dinheiro e cartões de crédito/débito." },
  { p: "Precisa pagar antecipado?", r: "Pedimos um sinal para garantir a reserva, principalmente em alta temporada. O restante pode ser pago no embarque." },
  { p: "É seguro comprar com vocês?", r: "Totalmente! Somos uma empresa registrada (CNPJ 26.096.072/0001-78) e temos milhares de clientes atendidos. Pode conferir nosso Instagram @calebstour." },
  { p: "Criança paga?", r: "Crianças até 5 anos geralmente são isentas ou pagam taxa mínima (consulte por passeio). De 6 a 10 anos tem desconto em alguns roteiros." },
  { p: "E se chover?", r: "Se o tempo impedir a saída (marinha fechar o porto), remarcamos seu passeio ou fazemos o reembolso integral. Se for apenas chuva fraca e o mar estiver seguro, o passeio sai normalmente." },
  { p: "Tem estacionamento?", r: "Não temos estacionamento privativo no cais, mas existem vários estacionamentos pagos nas redondezas da Praia dos Anjos." },
  { p: "Posso levar bebida?", r: "Geralmente não é permitido levar cooler com bebidas, pois os barcos vendem a bordo e oferecem água liberada. Consulte regras específicas para lanchas privadas." },
  { p: "O que levar no passeio?", r: "Protetor solar, chapéu, óculos de sol, toalha, roupa de banho e dinheiro/cartão para extras." }
];

export const TOURS_INFO = {
  barco_arraial: {
    nome: "Passeio de Barco - Arraial do Cabo",
    categoria: "Passeios de Barco",
    destaque: true,
    duracao: "3h30 a 4h",
    saidas: ["09:30", "12:30"],
    embarque: "Marina dos Pescadores (Cais da Praia dos Anjos)",
    descricao_curta: "O clássico Caribe Brasileiro. Água liberada e roteiro completo.",
    roteiro: [
      "Ilha do Farol (Desembarque 40min)",
      "Prainhas do Pontal do Atalaia (Desembarque 40min)",
      "Praia do Forno (Mergulho ao redor)",
      "Gruta Azul (Panorâmico)",
      "Fenda de Nossa Senhora (Panorâmico)",
      "Pedra do Gorila (Panorâmico)",
      "Buraco do Meteoro (Panorâmico)"
    ],
    incluso: ["Água liberada", "Guia credenciado", "Bote de apoio", "Coletes", "Banheiro", "Som"],
    nao_incluso: ["Taxa de embarque R$ 10,00", "Almoço", "Bebidas alcoólicas"],
    faq: [
      { p: "O barco balança muito?", r: "O roteiro é bem protegido, costuma ser tranquilo. Se tem enjoo fácil, recomendamos tomar um remédio 1h antes." },
      { p: "Tem banheiro?", r: "Sim, nossas embarcações têm banheiro." },
      { p: "Pode descer na Praia do Forno?", r: "A parada é para mergulho ao redor. O desembarque na areia depende das condições e autorização no dia." }
    ]
  },
  escuna_buzios: {
    nome: "Passeio de Escuna - Búzios",
    categoria: "Passeios de Barco",
    duracao: "2h30",
    descricao_curta: "Visite 12 praias e 3 ilhas na charmosa Búzios.",
    roteiro: [
      "Praia da Armação, Ossos, Azeda/Azedinha",
      "João Fernandes (Parada para mergulho)",
      "Ilha Feia (Parada para mergulho)",
      "Praia da Tartaruga (Parada para mergulho)",
      "Praia das Virgens, Amores, Canto"
    ],
    incluso: ["Guia", "Animação a bordo", "Coletes"],
    faq: []
  },
  barco_cabofrio: {
    nome: "Passeio de Barco - Cabo Frio",
    categoria: "Passeios de Barco",
    duracao: "2h30 a 3h",
    descricao_curta: "História e belezas naturais de Cabo Frio.",
    roteiro: [
      "Ilha do Japonês",
      "Forte São Mateus",
      "Praia do Forte",
      "Farol da Lajinha",
      "Praia Brava (Vista panorâmica - área de nudismo)",
      "Ilha dos Papagaios (Parada para mergulho)"
    ],
    faq: []
  },
  lancha_privada: {
    nome: "Passeio de Lancha Privada",
    categoria: "Passeios de Barco",
    tipo: "Privativo",
    descricao_curta: "Exclusividade e conforto para seu grupo.",
    ideal_para: ["Casais", "Famílias", "Grupos de amigos", "Comemorações"],
    faq: [
      { p: "Quantas pessoas cabem na lancha?", r: "Depende da lancha do dia, em média de 6 a 12 pessoas. Confirmamos certinho na cotação." },
      { p: "Posso escolher o horário?", r: "Sim, a lancha é privativa e os horários são mais flexíveis, de acordo com a tábua de maré e agenda." }
    ]
  },
  catamara_black: {
    nome: "Catamarã / Black Diamond",
    categoria: "Passeios de Barco",
    descricao_curta: "Embarcações diferenciadas (festas/temáticas).",
    ideal_para: ["Grupos grandes", "Festivais", "Eventos corporativos"],
    faq: [
      { p: "É passeio aberto ou só grupo fechado?", r: "Trabalhamos com saídas em grupo e também opções para fretamento exclusivo, conforme a data." }
    ]
  },
  barco_taxi: {
    nome: "Barco Táxi",
    categoria: "Passeios de Barco",
    descricao_curta: "Transporte rápido entre praias e pontos turísticos.",
    faq: [
      { p: "Precisa reservar com antecedência?", r: "Recomendamos avisar antes, mas em baixa temporada muitas vezes conseguimos encaixe rápido." }
    ]
  },
  quadriciclo: {
    nome: "Passeio de Quadriciclo",
    categoria: "Aventura Off-Road",
    duracao: "2h30",
    saidas: ["08:00", "10:30", "13:00", "15:30"],
    capacidade: "2 pessoas por máquina",
    descricao_curta: "Adrenalina nas dunas e lagoas.",
    roteiro: [
      "Pedreira",
      "Lagoa de Kite Surf",
      "Praia do Pontal",
      "Prainha",
      "Lagoa Vermelha",
      "Praia do Foguete",
      "Deserto da Praia Grande (dunas)"
    ],
    regras: ["CNH B para piloto", "Garupa min. 7 anos", "Tênis/Calçado fechado obrigatório"],
    incluso: ["Fotos e Vídeos GoPro", "Guia"],
    faq: [
      { p: "Precisa de carteira?", r: "Sim, o piloto precisa de CNH B (carro)." },
      { p: "Criança pode ir?", r: "Na garupa, a partir de 7 anos." }
    ]
  },
  buggy: {
    nome: "Passeio de Buggy",
    categoria: "Aventura Off-Road",
    duracao: "2h",
    descricao_curta: "Passeio clássico e panorâmico para curtir o vento no rosto e as belezas da região.",
    roteiro: [
      "Prainha",
      "Praia do Pontal",
      "Lagoa",
      "Praia do Foguete",
      "Praia Grande (pôr do sol no horário da tarde)"
    ],
    faq: []
  },
  utv: {
    nome: "UTV",
    categoria: "Aventura Off-Road",
    descricao_curta: "Veículo 4x4 potente para trilhas mais agressivas.",
    ideal_para: ["Quem já fez quadri ou buggy", "Aventureiros"],
    faq: []
  },
  jeep_tour: {
    nome: "Jeep Tour",
    categoria: "Aventura Off-Road",
    descricao_curta: "Passeio 4x4 coletivo ou privado.",
    faq: []
  },
  mergulho: {
    nome: "Mergulho de Cilindro (Batismo)",
    categoria: "Esportes Aquáticos",
    duracao: "Tour total 2-3h (30min de fundo)",
    profundidade: "5 a 10 metros",
    local: "Ilha dos Porcos ou Praia do Forno (depende do mar)",
    regras: ["Idade mínima 10 anos", "Não precisa saber nadar"],
    incluso: ["Equipamento completo", "Instrutor exclusivo", "Fotos subaquáticas", "Lanche"],
    faq: [
      { p: "Preciso saber nadar?", r: "Não! O instrutor te conduz o tempo todo, bem coladinho em você." },
      { p: "Dá medo?", r: "É super tranquilo e controlado. Antes de descer, o instrutor explica tudo e faz um treino na superfície." }
    ]
  },
  jet_ski: {
    nome: "Jet Ski",
    categoria: "Esportes Aquáticos",
    duracao: "20-30min (passeio) ou locação 1h",
    descricao_curta: "Velocidade e liberdade no mar.",
    regras: ["Passageiro min. 10 anos", "Piloto min. 18 anos"],
    incluso: ["Colete", "Instrutor/Guia"],
    faq: []
  },
  canoa_havaiana: {
    nome: "Canoa Havaiana",
    categoria: "Esportes Aquáticos",
    descricao_curta: "Experiência de remo em equipe com visual incrível.",
    ideal_para: ["Grupos", "Famílias", "Equipe de amigos"],
    faq: []
  },
  caiaque_transparente: {
    nome: "Caiaque Transparente",
    categoria: "Esportes Aquáticos",
    descricao_curta: "Fotos incríveis com fundo transparente.",
    faq: []
  },
  aula_surf: {
    nome: "Aula de Surf",
    categoria: "Esportes Aquáticos",
    descricao_curta: "Aprenda a surfar nas ondas da região.",
    faq: []
  },
  paramotor: {
    nome: "Voo de Paramotor",
    categoria: "Aéreos",
    descricao_curta: "Veja o paraíso de cima com segurança.",
    ideal_para: ["Casais", "Quem quer fotos aéreas"],
    faq: []
  },
  city_rio: {
    nome: "City Tour Rio de Janeiro",
    categoria: "City Tours",
    descricao_curta: "Bate-volta para Cristo Redentor, Pão de Açúcar e principais pontos.",
    faq: []
  },
  city_local: {
    nome: "City Tour Local",
    categoria: "City Tours",
    descricao_curta: "Tour terrestre histórico e cultural por Cabo Frio/Arraial.",
    faq: []
  },
  hospedagem: {
    nome: "Hospedagens",
    categoria: "Serviços",
    descricao_curta: "Reservas de casas e pousadas parceiras.",
    faq: [
      { p: "Vocês ajudam com hospedagem?", r: "Sim! Temos casas e pousadas parceiras e te ajudamos a achar a melhor opção pro seu perfil." }
    ]
  },
  combo_barco_quadri: {
    nome: "Combo Barco + Quadriciclo",
    categoria: "Combos",
    descricao_curta: "Pacote especial unindo Caribe Brasileiro no barco + aventura off-road no quadriciclo.",
    beneficios: ["Economia de 10-20%", "Flexibilidade para fazer em dias diferentes"],
    faq: []
  }
};

export const CALEB_INFO = `
SOBRE A EMPRESA:
Nome: Caleb's Tour Company (CTC)
Slogan: "O Caribe Brasileiro é aqui!"
Instagram: @calebstour
Localização: Região dos Lagos (Arraial do Cabo, Cabo Frio, Búzios)
Missão: Oferecer as melhores experiências turísticas com segurança e alegria.

DIFERENCIAIS:
- Atendimento humanizado e rápido
- Vouchers profissionais
- Diversidade de passeios (Mar, Terra e Ar)
- Milhares de clientes satisfeitos
- Fotos GoPro inclusas no Quadriciclo
- Fotos subaquáticas inclusas no Mergulho

REGRAS GERAIS DE CANCELAMENTO:
- Chuva forte/Marinha fechou: Reagendamento ou Reembolso 100%.
- Desistência do cliente: Avisar com 24h de antecedência para reembolso (pode ter taxa administrativa). Menos de 24h geralmente perde o sinal (No-Show).

LOCAIS DE EMBARQUE:
- Arraial: Cais da Praia dos Anjos.
- Cabo Frio: Terminal de Barcos no Canal.
- Búzios: Pier da Praia da Armação.
`;

export const FAQ_PERFIL = {
  familia_bebe: [
    {
      p: "Qual passeio é melhor com bebê ou criança pequena?",
      r: "Recomendamos o Passeio de Barco em Arraial e o City Tour Local, que são mais confortáveis e com estrutura melhor para família. Sempre sugerimos levar protetor solar, chapéu e uma roupinha extra."
    },
    {
      p: "Carrinho de bebê pode embarcar?",
      r: "Depende da lotação e do barco do dia, mas em geral carrinhos grandes não são ideais. Melhor levar canguru ou sling."}
  ],
  casal_lua_de_mel: [
    {
      p: "O que você recomenda pra casal em lua de mel?",
      r: "Lancha privativa ao pôr do sol, Passeio de Barco em Arraial em horário mais vazio e Voo de Paramotor para fotos aéreas são as opções mais românticas."}
  ],
  grupo_grande: [
    {
      p: "Tem opção pra grupo grande / excursão?",
      r: "Sim! Podemos montar saídas em barco, escuna, catamarã ou combo de passeios para grupos, com condições especiais acima de 10 pessoas."}
  ]
};

export const FAQ_TEMPORADA = {
  alta_vs_baixa: [
    {
      p: "Qual a diferença de ir em alta ou baixa temporada?",
      r: "Na alta temporada (verão, feriados), a cidade fica mais cheia, os horários lotam rápido e os preços sobem um pouco. Em baixa temporada é mais tranquilo, com praias vazias e mais flexibilidade de agenda."}
  ],
  melhor_epoca: [
    {
      p: "Qual a melhor época pra ir pra Arraial?",
      r: "O ano todo é lindo, mas de abril a junho e setembro a novembro costumam ter água bem clara e cidade mais tranquila. No verão o clima é mais animado, porém com mais movimento."}
  ],
  clima_vento_agua: [
    {
      p: "A água é muito gelada?",
      r: "Arraial é famoso pela água mais fria, mas muito cristalina. Em dias de sol forte a sensação fica bem agradável."},
    {
      p: "Venda muito, o passeio cancela?",
      r: "Quando o vento ou o mar ficam fora do padrão de segurança, a Marinha pode fechar o porto. Nesses casos a gente remarca ou devolve o valor."}
  ]
};

export const FALLBACK_QUESTIONS = [
  "Como chegar em Arraial?",
  "Onde comer barato?",
  "Qual a melhor praia?",
  "Tem Uber na cidade?",
  "Onde ver o pôr do sol?"
];
