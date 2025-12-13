-- ATUALIZAÇÃO DOS PASSEIOS COM DADOS REAIS DO CONCORRENTE
-- Baseado em: https://arraialsun.com.br/

-- Deletar passeios antigos (exceto se já houver reservas)
DELETE FROM passeios WHERE id NOT IN (SELECT DISTINCT passeio_id FROM reservas WHERE passeio_id IS NOT NULL);

-- 1. PASSEIO DE BARCO COM TOBOÁGUA - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  'bd2c64ee-8900-48e9-9512-930dc44041ce',
  'Passeio de Barco com Toboágua',
  'Passeio de Barco',
  'Embarcação exclusiva de 2 andares com toboágua, banheiros, bar, petiscos, música e animação. Tour com duração média de 4h pelas principais praias e pontos naturais do Caribe Brasileiro.',
  'Arraial do Cabo, RJ',
  '4 horas',
  59.90,
  59.90,
  '02 Andares, Toboágua, Balanço, Bóias, Animador, Música ambiente, Bolas flutuadoras, Água mineral durante o passeio. Roteiro: Pier Praia dos Anjos (embarque), Ilha do Farol (parada), Pedra do Macaco (vista), Fenda da Nossa Senhora (vista), Gruta Azul (vista), Prainhas Pontal do Atalaia (vista), Praia do Forno (parada), Pier Praia dos Anjos (desembarque). Taxa de embarque R$10,00 não inclusa.',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 2. PASSEIO DE BARCO OPEN BAR + OPEN FOOD - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '8a3c54fa-9900-48e9-9512-930dc44041aa',
  'Passeio de Barco Open Bar + Open Food',
  'Passeio de Barco',
  'Embarcação exclusiva de 2 andares com banheiros, bar, churrasco liberado, bebida liberada, petiscos, fotografia, música e animação. Tour com duração média de 4h pelas principais praias e pontos naturais do Caribe Brasileiro.',
  'Arraial do Cabo, RJ',
  '4 horas',
  169.90,
  250.00,
  '02 Andares, Toboágua, Animador, Música ambiente, Boias flutuadoras, Bebida Liberada, Churrasco Liberado, Almoço buffet livre em restaurante. Roteiro igual ao passeio tradicional. Taxa de embarque R$10,00 não inclusa.',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 3. PASSEIO DE QUADRICICLO AUTOMÁTICO - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '20d2e3f1-6a41-4a31-854a-176f71dd7e10',
  'Passeio de Quadriciclo Automático com Direção Elétrica',
  'Aventura Off-Road',
  'Quadriciclo automático com direção elétrica para 2 pessoas. Fácil de pilotar, a partir de 7 anos. Você pilota! Inclui fotos no Crau, parada para mergulho, guia local e estacionamento.',
  'Arraial do Cabo, RJ',
  '2 horas',
  200.00,
  300.00,
  'Quadriciclo automático, Direção elétrica, Capacidade: 2 pessoas, Foto no Crau, Parada para Mergulho, Guia Local, Estacionamento',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 4. PASSEIO DE BUGGY - ROTEIRO TRADICIONAL - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  'fdaa7c3d-e127-41ef-bc32-d3637f71a17e',
  'Passeio de Buggy - Roteiro Tradicional',
  'Aventura Off-Road',
  'Passeio de buggy por 04 praias e 01 lagoa em Arraial do Cabo. Fácil e confortável para até 2 pessoas.',
  'Arraial do Cabo, RJ',
  '2 horas',
  250.00,
  300.00,
  '04 Praias + 01 Lagoa, Foto nos Pontos, Parada para Mergulho, Estacionamento, Banheiro, Guia Local',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 5. PASSEIO DE BUGGY - ROTEIRO ARUBINHA - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '1ff413e0-5163-4214-99e2-a419cd594b36',
  'Passeio de Buggy - Roteiro Arubinha',
  'Aventura Off-Road',
  'Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo! Praia Branca, parada para mergulho, trilha selvagem.',
  'Arraial do Cabo, RJ',
  '4 horas',
  550.00,
  550.00,
  'Praia Branca, Parada para Mergulho, Trilha Selvagem, Estacionamento, Banheiro, Guia Local',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 6. BUGGY EXCLUSIVO COM FOTOS - 7 horas - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '407de9cd-f9f9-46d3-bf36-0aa9461e97a2',
  'Buggy Exclusivo com Fotos',
  'Aventura Off-Road',
  'UM DIA EM ARRAIAL! Explore as belezas de Arraial do Cabo em um emocionante passeio de buggy com fotos, mergulhos e um pôr do sol inesquecível!',
  'Arraial do Cabo, RJ',
  '7 horas',
  1200.00,
  1200.00,
  'Fotos Gratuitas, Parada para Mergulho, Estacionamento, Banheiro, Guia Local',
  'Saídas às 07:30h',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 7. MERGULHO COM CILINDRO - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '9f00a217-011f-4b70-a08d-bb32c0a6e593',
  'Mergulho com Cilindro',
  'Mergulho',
  'Um paraíso debaixo d''água! Mergulhe com as tartarugas! Inclui fotos subaquáticas! A partir de 10 anos.',
  'Arraial do Cabo, RJ',
  '40 minutos',
  300.00,
  320.00,
  'Equipamento completo, Instrutor, Fotos Gratuitas subaquáticas, Kit Lanche. Não precisa saber nadar.',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 8. MERGULHO DE SNORKEL - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '5f00a217-011f-4b70-a08d-bb32c0a6e594',
  'Mergulho de Snorkel',
  'Mergulho',
  '02 horas admirando tartarugas marinhas! Não precisa saber nadar!',
  'Arraial do Cabo, RJ',
  '60 minutos',
  120.00,
  180.00,
  'Equipamento completo, Instrutor, Fotos Gratuitas, Trilha',
  'Consultar disponibilidade',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 9. COMBO BARCO + QUADRICICLO PARA 02 PESSOAS - Arraial do Cabo
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '6f00a217-011f-4b70-a08d-bb32c0a6e595',
  'Combo Barco + Quadriciclo para 02 Pessoas',
  'Combo',
  'Passeio de Barco com Toboágua (04 horas) + Passeio de Quadriciclo (Você pilota! Parada para fotos. Trilha off-road. Estacionamento grátis). Você poderá realizar os passeios no mesmo dia ou em dias diferentes!',
  'Arraial do Cabo, RJ',
  'Dia inteiro',
  300.00,
  450.00,
  'Passeio de Barco com Toboágua 04h + Passeio de Quadriciclo 02h. A partir de 7 anos.',
  'Flexível - Pode ser no mesmo dia ou em dias diferentes',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;

-- 10. CITY TOUR ARRAIAL DO CABO (Saindo do Rio de Janeiro)
INSERT INTO passeios (id, nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios, created_at) VALUES
(
  '7f00a217-011f-4b70-a08d-bb32c0a6e596',
  'City Tour Arraial do Cabo (Saindo do Rio)',
  'City Tour',
  'Explore o deslumbrante Arraial do Cabo com um emocionante tour de barco, desfrutando de paradas paradisíacas e conforto a bordo!',
  'Saída: Rio de Janeiro - Destino: Arraial do Cabo, RJ',
  'Dia inteiro',
  280.00,
  320.00,
  'Transporte ida e volta, Guia Bilingue, Almoço, Passeio de Barco com Toboágua. Ambiente familiar.',
  'Saídas às 07:00h',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  local = EXCLUDED.local,
  duracao = EXCLUDED.duracao,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  includes = EXCLUDED.includes,
  horarios = EXCLUDED.horarios;
