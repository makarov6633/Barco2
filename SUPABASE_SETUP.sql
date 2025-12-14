-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT UNIQUE NOT NULL,
  email TEXT,
  cpf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Passeios
CREATE TABLE IF NOT EXISTS passeios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  local TEXT,
  duracao TEXT,
  preco_min NUMERIC(10,2),
  preco_max NUMERIC(10,2),
  includes TEXT,
  horarios TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Reservas
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  passeio_id UUID REFERENCES passeios(id) ON DELETE CASCADE,
  data_passeio TEXT NOT NULL,
  num_pessoas INTEGER NOT NULL,
  voucher TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'PENDENTE',
  valor_total NUMERIC(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Contextos de Conversa
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT UNIQUE NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversation_contexts
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;

-- Inserir passeios de exemplo (se não existirem)
INSERT INTO passeios (id, nome, categoria, preco_min, preco_max, duracao, local) VALUES
  ('bd2c64ee-8900-48e9-9512-930dc44041ce', 'Passeio de Barco - Arraial do Cabo', 'Passeio de Barco', 150.00, 280.00, '4-5h', 'Arraial do Cabo, RJ'),
  ('fdaa7c3d-e127-41ef-bc32-d3637f71a17e', 'Escuna - Búzios', 'Passeio de Escuna', 120.00, 200.00, '3-4h', 'Búzios, RJ'),
  ('1ff413e0-5163-4214-99e2-a419cd594b36', 'Jet Ski', 'Esporte Aquático', 200.00, 350.00, '30-60min', 'Arraial do Cabo, RJ'),
  ('407de9cd-f9f9-46d3-bf36-0aa9461e97a2', 'Mergulho com Cilindro', 'Mergulho', 250.00, 400.00, '2-3h', 'Arraial do Cabo, RJ'),
  ('20d2e3f1-6a41-4a31-854a-176f71dd7e10', 'Buggy nas Dunas', 'Aventura Terrestre', 180.00, 300.00, '2-3h', 'Cabo Frio, RJ'),
  ('9f00a217-011f-4b70-a08d-bb32c0a6e593', 'Van Tour Região dos Lagos', 'City Tour', 80.00, 150.00, '6-8h', 'Região dos Lagos, RJ')
ON CONFLICT (id) DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_voucher ON reservas(voucher);
CREATE INDEX IF NOT EXISTS idx_contexts_telefone ON conversation_contexts(telefone);
