# 🎯 8 NOVOS PASSEIOS - PRONTOS PARA INSERIR

## ✅ PASSEIOS QUE FALTAVAM (APENAS 8)

Comparação correta entre CSV e Site identificou **APENAS 8 passeios novos**:

---

### 1. 🏎️ PASSEIO DE BUGGY - ROTEIRO ARUBINHA
- **Preço:** R$ 550,00 / buggy
- **Duração:** 4 horas
- **Descrição:** Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo!
- **Inclui:** Buggy completo, roteiro diferenciado com praias escondidas
- **Imagem:** ✅ `passeio-buggy-arubinha-roteiro.jpg`

---

### 2. 🎯 COMBO BARCO + QUADRICICLO AUTOMÁTICO PARA 02 PESSOAS
- **Preço:** R$ 300,00 / combo
- **Duração:** Flexível
- **Descrição:** Você poderá realizar os passeios no mesmo dia ou em dias diferentes!
- **Inclui:** Para 02 pessoas, barco 4h + quadriciclo 2h, a partir de 7 anos
- **Imagem:** ✅ `passeio-combo-barco-quad.jpg`

---

### 3. 📸 Buggy Exclusivo com Fotos
- **Preço:** R$ 1.200,00 / buggy
- **Duração:** 7 horas (dia inteiro)
- **Descrição:** Explore as belezas de Arraial do Cabo em um emocionante passeio de buggy com fotos, mergulhos e um pôr do sol inesquecível!
- **Inclui:** Guia profissional, fotos profissionais, paradas para mergulho, pôr do sol
- **Imagem:** ✅ `passeio-buggy-exclusivo-sunset.jpg`

---

### 4. 🏙️ City Tour Arraial do Cabo (Saindo do Rio de Janeiro)
- **Preço:** R$ 280,00 / pessoa
- **Duração:** Dia inteiro
- **Descrição:** Explore o deslumbrante Arraial do Cabo com um emocionante tour de barco!
- **Inclui:** Transporte ida/volta do Rio, passeio de barco, guia, ambiente familiar
- **Horário:** Saída às 6h do Rio de Janeiro
- **Imagem:** ✅ `passeio-city-tour-rio.jpg`

---

### 5. 🍖 Passeio de Barco Open Bar + Open Food
- **Preço:** R$ 169,90 / pessoa
- **Duração:** aprox. 4 horas
- **Descrição:** Passeio de barco com toboágua, open bar e churrasco à vontade!
- **Inclui:** Open bar, open food (churrasco liberado), toboágua, paradas para mergulho
- **Imagem:** ✅ `passeio-barco-openbar-food.jpg`

---

### 6. ⛵ PASSEIO DE BARCO EXCLUSIVO EM ARRAIAL DO CABO
- **Preço:** R$ 2.400,00 / até 10 pessoas
- **Duração:** 4-5 horas
- **Descrição:** Família, amigos, churrasco e um barco somente para você!
- **Inclui:** Barco exclusivo privativo, até 10 pessoas, guia, churrasco, roteiro personalizado
- **Imagem:** ✅ `passeio-barco-exclusivo-privativo.jpg`

---

### 7. 🎫 UM DIA EM ARRAIAL DO CABO
- **Preço:** R$ 900,00 / combo
- **Duração:** Dia inteiro
- **Descrição:** TRANSPORTE + PASSEIO DE BARCO + PASSEIO DE QUADRICICLO
- **Inclui:** Transporte ida/volta, barco 4h, quadriciclo 2h
- **Horário:** Saída às 7h
- **Imagem:** ✅ `passeio-um-dia-arraial.jpg`

---

### 8. 🚐 TRANSFER EXCLUSIVO
- **Preço:** R$ 750,00 / veículo
- **Duração:** Flexível
- **Descrição:** Spin 06 passageiros com bancos de couro e ar condicionado
- **Inclui:** Mercedes Sprinter, até 06 passageiros, ar condicionado, bancos de couro, motorista profissional
- **Disponibilidade:** 24h sob demanda
- **Imagem:** ✅ `transfer-van-exclusivo.jpg`

---

## 📁 ARQUIVOS CRIADOS

### Scripts:
- ✅ `scripts/insert-8-novos-passeios.sql` - SQL direto
- ✅ `scripts/insert-8-novos-passeios.py` - Python automatizado

### Imagens (8 profissionais):
- ✅ `public/passeio-buggy-arubinha-roteiro.jpg`
- ✅ `public/passeio-combo-barco-quad.jpg`
- ✅ `public/passeio-buggy-exclusivo-sunset.jpg`
- ✅ `public/passeio-city-tour-rio.jpg`
- ✅ `public/passeio-barco-openbar-food.jpg`
- ✅ `public/passeio-barco-exclusivo-privativo.jpg`
- ✅ `public/passeio-um-dia-arraial.jpg`
- ✅ `public/transfer-van-exclusivo.jpg`

---

## 🚀 COMO INSERIR

### Opção 1: Python (Recomendado)
```bash
cd /project/workspace/makarov6633/Barco2
export NEXT_PUBLIC_SUPABASE_URL="sua_url"
export SUPABASE_SERVICE_ROLE_KEY="sua_chave"
python3 scripts/insert-8-novos-passeios.py
```

### Opção 2: SQL Direto
1. Acesse Supabase Dashboard → SQL Editor
2. Cole o conteúdo de `scripts/insert-8-novos-passeios.sql`
3. Execute

---

## ✅ VALIDAÇÃO

Após inserir, verifique no Supabase:
```sql
SELECT nome, categoria, preco_min 
FROM passeios 
WHERE nome IN (
  'PASSEIO DE BUGGY - ROTEIRO ARUBINHA',
  'COMBO BARCO + QUADRICICLO AUTOMÁTICO PARA 02 PESSOAS',
  'Buggy Exclusivo com Fotos',
  'City Tour Arraial do Cabo (Saindo do Rio de Janeiro)',
  'Passeio de Barco Open Bar + Open Food',
  'PASSEIO DE BARCO EXCLUSIVO EM ARRAIAL DO CABO',
  'UM DIA EM ARRAIAL DO CABO',
  'TRANSFER EXCLUSIVO'
);
```

---

**Status:** ✅ Pronto para inserção  
**Data:** 13/12/2025
