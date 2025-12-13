-- Script SQL para inserir APENAS os 8 passeios que faltam no banco de dados
-- Execute no Supabase SQL Editor

-- 1. PASSEIO DE BUGGY - ROTEIRO ARUBINHA
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('PASSEIO DE BUGGY - ROTEIRO ARUBINHA', 
 'Aventura Terrestre', 
 'Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo!', 
 'Arraial do Cabo, RJ', 
 '4 horas', 
 550.00, 
 550.00, 
 'Buggy completo, roteiro diferenciado com praias escondidas', 
 'Manhã ou tarde - sob agendamento')
ON CONFLICT DO NOTHING;

-- 2. COMBO BARCO + QUADRICICLO AUTOMÁTICO PARA 02 PESSOAS
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('COMBO BARCO + QUADRICICLO AUTOMÁTICO PARA 02 PESSOAS', 
 'Combo', 
 'Você poderá realizar os passeios no mesmo dia ou em dias diferentes!', 
 'Arraial do Cabo, RJ', 
 'Flexível', 
 300.00, 
 300.00, 
 'A partir de 7 anos, para 02 pessoas, passeio de barco 4h + quadriciclo 2h', 
 'Flexível - combine com a equipe')
ON CONFLICT DO NOTHING;

-- 3. Buggy Exclusivo com Fotos
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('Buggy Exclusivo com Fotos', 
 'Aventura Terrestre', 
 'Explore as belezas de Arraial do Cabo em um emocionante passeio de buggy com fotos, mergulhos e um pôr do sol inesquecível!', 
 'Arraial do Cabo, RJ', 
 '7 horas', 
 1200.00, 
 1200.00, 
 'Guia profissional, fotos profissionais inclusas, paradas para mergulho, pôr do sol', 
 'Saída às 9h - dia inteiro')
ON CONFLICT DO NOTHING;

-- 4. City Tour Arraial do Cabo (Saindo do Rio de Janeiro)
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('City Tour Arraial do Cabo (Saindo do Rio de Janeiro)', 
 'City Tour', 
 'Explore o deslumbrante Arraial do Cabo com um emocionante tour de barco, desfrutando de paradas paradisíacas e conforto a bordo!', 
 'Rio de Janeiro → Arraial do Cabo, RJ', 
 'Dia inteiro', 
 280.00, 
 280.00, 
 'Transporte ida/volta do Rio, passeio de barco completo, guia, ambiente familiar', 
 'Saída às 6h do Rio de Janeiro')
ON CONFLICT DO NOTHING;

-- 5. Passeio de Barco Open Bar + Open Food
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('Passeio de Barco Open Bar + Open Food', 
 'Passeio de Barco', 
 'Explore as paisagens deslumbrantes de Arraial do Cabo em um passeio de barco inesquecível com toboágua, open bar e churrasco à vontade!', 
 'Arraial do Cabo, RJ', 
 'aprox. 4 horas', 
 169.90, 
 169.90, 
 'Open bar (bebidas liberadas), open food (churrasco à vontade), toboágua, paradas para mergulho', 
 'Saída às 10h')
ON CONFLICT DO NOTHING;

-- 6. PASSEIO DE BARCO EXCLUSIVO EM ARRAIAL DO CABO
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('PASSEIO DE BARCO EXCLUSIVO EM ARRAIAL DO CABO', 
 'Passeio de Barco', 
 'Família, amigos, churrasco e um barco somente para você!', 
 'Arraial do Cabo, RJ', 
 '4-5 horas', 
 2400.00, 
 2400.00, 
 'Até 10 pessoas, barco exclusivo privativo, guia, churrasco, roteiro personalizado', 
 'Horário flexível - agende com antecedência')
ON CONFLICT DO NOTHING;

-- 7. UM DIA EM ARRAIAL DO CABO
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('UM DIA EM ARRAIAL DO CABO', 
 'Combo', 
 'TRANSPORTE + PASSEIO DE BARCO + PASSEIO DE QUADRICICLO', 
 'Arraial do Cabo, RJ', 
 'Dia inteiro', 
 900.00, 
 900.00, 
 'Transporte ida e volta, passeio de barco completo 4h, passeio de quadriciclo 2h', 
 'Saída às 7h - pacote completo')
ON CONFLICT DO NOTHING;

-- 8. TRANSFER EXCLUSIVO
INSERT INTO passeios (nome, categoria, descricao, local, duracao, preco_min, preco_max, includes, horarios) VALUES
('TRANSFER EXCLUSIVO', 
 'Transfer', 
 'Spin 06 passageiros com bancos de couro e ar condicionado.', 
 'Região dos Lagos, RJ', 
 'Flexível', 
 750.00, 
 750.00, 
 'Veículo exclusivo Mercedes Sprinter, até 06 passageiros, ar condicionado, bancos de couro, motorista profissional', 
 'Sob demanda - 24h')
ON CONFLICT DO NOTHING;

-- Verificar passeios inseridos
SELECT nome, categoria, preco_min, duracao FROM passeios ORDER BY created_at DESC LIMIT 8;
