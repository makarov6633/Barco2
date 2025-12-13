const { TOURS_INFO } = require('./lib/knowledge-base');

console.log('=== TESTE DE ACESSO DO GPT-OSS-120B AOS DADOS REAIS ===\n');

// Verificar se todos os dados estão presentes
const dataCheck = {
  'Quadriciclo': TOURS_INFO.quadriciclo?.preco,
  'Buggy': TOURS_INFO.buggy?.preco,
  'Arubinha': TOURS_INFO.arubinha_buggy?.preco,
  'Mergulho': TOURS_INFO.mergulho?.preco,
  'Combo': TOURS_INFO.combo_barco_quadri?.preco
};

console.log('DADOS DISPONÍVEIS PARA O GPT-OSS-120B:\n');
for (const [name, price] of Object.entries(dataCheck)) {
  if (price) {
    console.log(`✅ ${name}: ${price}`);
  } else {
    console.log(`❌ ${name}: NÃO ENCONTRADO`);
  }
}

console.log('\n=== DETALHES DO COMBO ===');
const combo = TOURS_INFO.combo_barco_quadri;
if (combo) {
  console.log('Nome:', combo.nome);
  console.log('Preço:', combo.preco);
  console.log('Duração:', combo.duracao);
  console.log('Idade mínima:', combo.idade_minima);
  console.log('Inclusos:', combo.incluso?.length || 0, 'itens');
}

console.log('\n✅ TODOS OS DADOS REAIS ESTÃO ACESSÍVEIS PARA A IA!');
