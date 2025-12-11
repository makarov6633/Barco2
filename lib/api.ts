import fs from 'fs';
import path from 'path';

// Caminho para o arquivo oficial (fora da pasta do site para fácil edição)
const PORTFOLIO_PATH = path.join(process.cwd(), '../portfolio_oficial_calebstour.md');

export function getPortfolioContent() {
  try {
    const fileContents = fs.readFileSync(PORTFOLIO_PATH, 'utf8');
    return fileContents;
  } catch (error) {
    console.error('Erro ao ler portfolio:', error);
    return 'Conteúdo não encontrado.';
  }
}

// Função para extrair serviços estruturados (Simulação de parser - Fase 2 faremos um parser real)
export function getServices() {
    return [
        {
            id: 'barco-arraial',
            title: 'Passeio de Barco - Arraial do Cabo',
            price: 'A partir de R$ 120,00',
            image: '/images/barco.jpg', // Placeholder
            description: 'O Caribe Brasileiro! Visite a Ilha do Farol, Prainhas do Pontal e Gruta Azul.',
            features: ['Água Liberada', '4h de Duração', 'Guia Incluso'],
            whatsappMessage: 'Olá! Gostaria de reservar o Passeio de Barco em Arraial!'
        },
        {
            id: 'quadriciclo',
            title: 'Passeio de Quadriciclo',
            price: 'Consulte valores',
            image: '/images/quadriciclo.jpg',
            description: 'Aventura off-road pelas dunas e lagoas. Roteiro exclusivo de 2h30.',
            features: ['Fotos GoPro', 'Piloto + Garupa', 'Roteiro de Dunas'],
            whatsappMessage: 'Olá! Quero saber mais sobre o Quadriciclo!'
        },
        {
            id: 'mergulho',
            title: 'Mergulho de Cilindro',
            price: 'Consulte valores',
            image: '/images/mergulho.jpg',
            description: 'Experiência subaquática segura para iniciantes. Não precisa saber nadar!',
            features: ['Fotos Inclusas', 'Instrutor Exclusivo', 'Equipamento Completo'],
            whatsappMessage: 'Olá! Tenho interesse no Mergulho de Batismo.'
        },
         {
            id: 'jet-ski',
            title: 'Passeio de Jet Ski',
            price: 'Consulte valores',
            image: '/images/jetski.jpg',
            description: 'Adrenalina pura nas águas cristalinas. Com ou sem instrutor.',
            features: ['Muita Emoção', 'Fotos Inclusas', 'Equipamento Salva-vidas'],
            whatsappMessage: 'Olá! Quero acelerar no Jet Ski!'
        }
    ];
}
