'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';

const tours = [
  {
    id: 'barco-arraial',
    title: 'PASSEIO DE BARCO COM TOBOÁGUA',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-barco-arraial.jpg',
    description: 'São 04 horas de passeio nas águas do Caribe Brasileiro!',
    duration: '4 horas',
    difficulty: 'Todos',
    startingAt: 'R$ 59,90',
    oldPrice: 'R$ 150,00',
    unit: 'pessoa',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero agendar o Passeio de Barco em Arraial!'
  },
  {
    id: 'buggy',
    title: 'Passeio de Buggy em Arraial do Cabo - ROTEIRO TRADICIONAL',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-buggy-praia.jpg',
    description: 'Conheça 04 praias e 01 lagoa durante 02 horas!',
    duration: '2 horas',
    difficulty: 'Aventura',
    startingAt: 'R$ 250,00',
    oldPrice: '',
    unit: 'buggy',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero reservar o Passeio de Buggy!'
  },
  {
    id: 'quadriciclo',
    title: 'PASSEIO DE QUADRICICLO AUTOMÁTICO COM DIREÇÃO ELÉTRICA',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-quadriciclo-grupo.jpg',
    description: 'Roteiro off-road inesquecível!',
    duration: '1h30',
    difficulty: 'Aventura',
    startingAt: 'R$ 200,00',
    oldPrice: '',
    unit: 'quadriciclo',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero agendar o Quadriciclo!'
  },
  {
    id: 'mergulho-cilindro',
    title: 'Mergulho com Cilindro',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-mergulho-cilindro.jpg',
    description: 'Equipamento Instrutor',
    duration: '2 horas',
    difficulty: 'Moderado',
    startingAt: 'R$ 300,00',
    oldPrice: '',
    unit: 'pessoa',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero agendar o Mergulho com Cilindro!'
  },
  {
    id: 'mergulho-snorkel',
    title: 'Mergulho de Snorkel',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-mergulho-snorkel.jpg',
    description: 'Equipamento Instrutor',
    duration: '1h30',
    difficulty: 'Fácil',
    startingAt: 'R$ 120,00',
    oldPrice: '',
    unit: 'pessoa',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero agendar o Mergulho de Snorkel!'
  },
  {
    id: 'paramotor',
    title: 'Voo de Paramotor',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-paramotor.jpg',
    description: 'Vistas aéreas com gravação em vídeo para casais ou solo',
    duration: '20 min',
    difficulty: 'Aventura',
    startingAt: 'R$ 400,00',
    oldPrice: '',
    unit: 'pessoa',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero agendar o Voo de Paramotor!'
  },
  {
    id: 'jet-ski',
    title: 'Jet Ski',
    subtitle: 'CABO FRIO/RJ',
    image: '/passeio-jet-ski.jpg',
    description: 'Velocidade e liberdade nas águas turquesas.',
    duration: '30 min',
    difficulty: 'Moderado',
    startingAt: 'R$ 200,00',
    oldPrice: '',
    unit: 'jet ski',
    badge: 'OFERTA IMPERDÍVEL',
    whatsappMessage: 'Olá! Quero saber sobre o Jet Ski!'
  },
  {
    id: 'escuna-buzios',
    title: 'Escuna - Búzios',
    subtitle: 'BÚZIOS/RJ',
    image: '/passeio-escuna-buzios.jpg',
    description: 'Visite 12 praias e 3 ilhas na charmosa Armação dos Búzios.',
    duration: '2h30',
    difficulty: 'Passeio',
    startingAt: 'Consulte',
    oldPrice: '',
    unit: 'pessoa',
    badge: '',
    whatsappMessage: 'Olá! Quero saber sobre a Escuna em Búzios!'
  },
  {
    id: 'lancha',
    title: 'Lancha Privada',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-lancha-privada.jpg',
    description: 'Experiência VIP: lancha exclusiva para seu grupo.',
    duration: '4 horas',
    difficulty: 'VIP',
    startingAt: 'Sob consulta',
    oldPrice: '',
    unit: 'lancha',
    badge: '',
    whatsappMessage: 'Olá! Quero saber sobre a Lancha Privada!'
  },
  {
    id: 'buggy-arubinha',
    title: 'PASSEIO DE BUGGY - ROTEIRO ARUBINHA',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-buggy-arubinha-roteiro.png',
    description: 'Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo!',
    duration: '4 horas',
    difficulty: 'Aventura',
    startingAt: 'R$ 550,00',
    oldPrice: '',
    unit: 'buggy',
    badge: '',
    whatsappMessage: 'Olá! Quero fazer o Passeio de Buggy - Roteiro Arubinha!'
  },
  {
    id: 'combo-barco-quad',
    title: 'COMBO BARCO + QUADRICICLO',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-combo-barco-quad.jpg',
    description: 'Você poderá realizar os passeios no mesmo dia ou em dias diferentes!',
    duration: 'Flexível',
    difficulty: 'Combo',
    startingAt: 'R$ 300,00',
    oldPrice: '',
    unit: '2 pessoas',
    badge: 'MELHOR COMBO',
    whatsappMessage: 'Olá! Quero agendar o Combo Barco + Quadriciclo!'
  },
  {
    id: 'buggy-exclusivo',
    title: 'Buggy Exclusivo com Fotos',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-buggy-exclusivo-com-fotos.jpeg',
    description: 'Explore as belezas de Arraial do Cabo com fotos profissionais e pôr do sol inesquecível!',
    duration: '7 horas',
    difficulty: 'Aventura Premium',
    startingAt: 'R$ 1.200,00',
    oldPrice: '',
    unit: 'buggy',
    badge: 'EXPERIÊNCIA COMPLETA',
    whatsappMessage: 'Olá! Quero agendar o Buggy Exclusivo com Fotos!'
  },
  {
    id: 'city-tour-rio',
    title: 'City Tour Arraial do Cabo',
    subtitle: 'SAINDO DO RIO DE JANEIRO',
    image: '/passeio-city-tour-rio.jpeg',
    description: 'Explore o deslumbrante Arraial do Cabo saindo do Rio de Janeiro com transporte e passeio de barco!',
    duration: 'Dia inteiro',
    difficulty: 'Conforto',
    startingAt: 'R$ 280,00',
    oldPrice: '',
    unit: 'pessoa',
    badge: 'SAÍDA DO RIO',
    whatsappMessage: 'Olá! Quero agendar o City Tour saindo do Rio!'
  },
  {
    id: 'barco-openbar',
    title: 'Passeio de Barco Open Bar + Open Food',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-barco-openbar-food.png',
    description: 'Passeio de barco inesquecível com toboágua, open bar e churrasco à vontade!',
    duration: '4 horas',
    difficulty: 'Festa',
    startingAt: 'R$ 169,90',
    oldPrice: '',
    unit: 'pessoa',
    badge: 'OPEN BAR + FOOD',
    whatsappMessage: 'Olá! Quero agendar o Barco Open Bar + Open Food!'
  },
  {
    id: 'barco-exclusivo',
    title: 'PASSEIO DE BARCO EXCLUSIVO',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-barco-exclusivo-privativo.png',
    description: 'Família, amigos, churrasco e um barco somente para você!',
    duration: '4-5 horas',
    difficulty: 'VIP Exclusivo',
    startingAt: 'R$ 2.400,00',
    oldPrice: '',
    unit: 'até 10 pessoas',
    badge: 'EXCLUSIVO',
    whatsappMessage: 'Olá! Quero agendar o Barco Exclusivo!'
  },
  {
    id: 'um-dia-arraial',
    title: 'UM DIA EM ARRAIAL DO CABO',
    subtitle: 'ARRAIAL DO CABO/RJ',
    image: '/passeio-um-dia-arraial.jpeg',
    description: 'TRANSPORTE + PASSEIO DE BARCO + PASSEIO DE QUADRICICLO',
    duration: 'Dia inteiro',
    difficulty: 'Combo Completo',
    startingAt: 'R$ 900,00',
    oldPrice: '',
    unit: 'combo',
    badge: 'PACOTE COMPLETO',
    whatsappMessage: 'Olá! Quero agendar Um Dia em Arraial do Cabo!'
  },
  {
    id: 'transfer-exclusivo',
    title: 'TRANSFER EXCLUSIVO',
    subtitle: 'REGIÃO DOS LAGOS/RJ',
    image: '/transfer-van-exclusivo.png',
    description: 'Van Mercedes Sprinter com 06 passageiros, bancos de couro e ar condicionado.',
    duration: 'Flexível',
    difficulty: 'Conforto',
    startingAt: 'R$ 750,00',
    oldPrice: '',
    unit: 'veículo',
    badge: 'TRANSFER VIP',
    whatsappMessage: 'Olá! Quero agendar o Transfer Exclusivo!'
  },
];

const moreServices = [
  { name: 'Catamarã / Black Diamond', desc: 'Festivais a bordo com karaokê, DJ e roteiros customizados' },
  { name: 'UTV 4x4', desc: 'Trilhas agressivas com guia, equipamentos e muita adrenalina' },
  { name: 'Jeep Tour', desc: 'Explora Passagem, praias e dunas em 4x4 coletivo ou privado' },
  { name: 'Canoa Havaiana', desc: 'Remada guiada no Caribe Brasileiro com fotos no nascer/pôr do sol' },
  { name: 'Caiaque Transparente', desc: 'Registro fotográfico com fundo cristalino nas Prainhas' },
  { name: 'Aula de Surf', desc: 'Instrutores credenciados nas ondas de Cabo Frio/Arraial' },
  { name: 'Voo de Paramotor', desc: 'Vistas aéreas com gravação em vídeo para casais ou solo' },
  { name: 'Hospedagem', desc: 'Casas e pousadas parceiras selecionadas pela CTC' },
];


const testimonials = [
  { name: 'Rafael Souza', city: 'Belo Horizonte', image: null, text: 'Passeio sensacional! A equipe é muito animada e as praias são surreais de lindas. Vale cada centavo.' },
  { name: 'Beatriz Alves', city: 'Goiânia', image: null, text: 'Organização nota 10. O barco é seguro e o roteiro é perfeito. A parada na Ilha do Farol é inesquecível.' },
  { name: 'Gabriel Ferreira', city: 'Vitória', image: null, text: 'O "Caribe Brasileiro" realmente existe! Água cristalina e muita vida marinha. Recomendo demais.' },
  { name: 'Carla Dias', city: 'Florianópolis', image: null, text: 'Melhor dia da viagem. O pôr do sol no barco foi mágico. Obrigada por tudo, Caleb!' },
  { name: 'Ana Silva', city: 'São Paulo', image: '/testimonials/ana.png', text: 'Experiência única! Fomos muito bem atendidos desde o check-in. As fotos ficaram incríveis.' },
  { name: 'Carlos Santos', city: 'Rio de Janeiro', image: '/testimonials/carlos.png', text: 'Transfer pontual e motorista educado. O passeio de barco superou todas as expectativas.' },
  { name: 'Mariana Costa', city: 'Curitiba', image: null, text: 'Águas cristalinas de Arraial são espetaculares! Vimos até tartarugas no mergulho.' },
  { name: 'Fernanda Rocha', city: 'Brasília', image: null, text: 'Buggy nas dunas é imperdível, muita emoção! E o passeio de barco fechou com chave de ouro.' },
];

const galleryImages = [
  '/wa-2025-12-12-1542-25-01.jpeg',
  '/wa-2025-12-12-1542-27-01.jpeg',
  '/wa-2025-12-12-1542-28-02.jpeg',
  '/wa-2025-12-12-1542-29-01.jpeg',
  '/wa-2025-12-12-1542-30-01.jpeg',
  '/wa-2025-12-12-1542-31-01.jpeg',
  '/wa-2025-12-12-1542-32-03-01.jpeg',
  '/wa-2025-12-12-1542-34-01-02.jpeg',
  '/wa-2025-12-12-1542-34-03.jpeg',
  '/wa-2025-12-12-1542-37-01.jpeg',
  '/wa-2025-12-12-1542-43-01.jpeg',
  '/wa-2025-12-12-1542-54-01-01.jpeg',
  '/wa-2025-12-12-1542-55.jpeg',
  '/whisk-c9e8337b.jpeg',
  '/galeria-barco-mar.jpeg',
  '/galeria-piscina-natural.jpeg',
  '/galeria-drink-polvo.jpeg',
  '/galeria-buggy-aventura.jpeg',
  '/galeria-familia-praia.jpeg',
  '/passeio-barco-arraial.jpg',
  '/passeio-lancha-privada.jpg',
  '/passeio-mergulho-snorkel.jpeg',
  '/passeio-paramotor.jpg',
];

const whatsappNumber = '5522998249911';
const whatsappLink = `https://wa.me/${whatsappNumber}`;

export default function Home() {
  const galleryRef = useRef<HTMLDivElement>(null);
  const testimonialRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = window.innerWidth < 768 ? 280 : 350;
      ref.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-2 md:py-3' : 'bg-transparent py-4 md:py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <Image
              src="/logo-ctc.png"
              alt="Caleb's Tour Co."
              width={45}
              height={45}
              className="rounded-full ring-2 ring-white/30 w-10 h-10 md:w-[50px] md:h-[50px]"
              quality={100}
              loading="eager"
              priority
            />
            <span className={`font-bold text-base md:text-lg hidden sm:block transition-colors font-heading tracking-wide ${scrolled ? 'text-[#0a4d54]' : 'text-white'}`}>
              Caleb&apos;s Tour
            </span>
          </Link>

          <button
            className="md:hidden p-2 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <svg className={`w-6 h-6 transition-colors ${scrolled ? 'text-[#0a4d54]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="#galeria" className={`text-sm font-medium transition-colors hover:text-[#25D366] ${scrolled ? 'text-gray-700' : 'text-white'}`}>
              Galeria
            </Link>
            <Link href="#passeios" className={`text-sm font-medium transition-colors hover:text-[#25D366] ${scrolled ? 'text-gray-700' : 'text-white'}`}>
              Passeios
            </Link>
            <Link href="#depoimentos" className={`text-sm font-medium transition-colors hover:text-[#25D366] ${scrolled ? 'text-gray-700' : 'text-white'}`}>
              Depoimentos
            </Link>
            <Link
              href={whatsappLink}
              target="_blank"
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-sm py-2.5 px-5 rounded-full transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Reservar
            </Link>
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-xl border-t">
            <nav className="flex flex-col p-4 gap-1">
              <Link href="#galeria" onClick={() => setMobileMenuOpen(false)} className="py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 rounded-lg">
                Galeria
              </Link>
              <Link href="#passeios" onClick={() => setMobileMenuOpen(false)} className="py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 rounded-lg">
                Passeios
              </Link>
              <Link href="#depoimentos" onClick={() => setMobileMenuOpen(false)} className="py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 rounded-lg">
                Depoimentos
              </Link>
              <Link
                href={whatsappLink}
                target="_blank"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-3 px-4 rounded-xl"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                Reservar Agora
              </Link>
            </nav>
          </div>
        )}
      </header>

      <section className="relative h-[100svh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
        >
          <source src="/WhatsApp%20Video%202025-12-10%20at%2001.18.34.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70"></div>

        <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 md:w-8 md:h-8 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      <div className="bg-[#0a4d54] text-white py-3 md:py-4 px-4 text-center text-xs md:text-sm font-medium">
        <span className="inline-flex items-center gap-3 flex-wrap justify-center">
          🚤 Garanta sua vaga no passeio hoje. Atendimento imediato no WhatsApp.
          <Link
            href={`${whatsappLink}?text=${encodeURIComponent('Quero reservar o passeio de barco hoje!')}`}
            target="_blank"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2 px-4 rounded-full transition-all hover:scale-105 active:scale-95"
          >
            Reservar agora
          </Link>
        </span>
      </div>

      <section id="passeios" className="py-16 md:py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#0a4d54] tracking-tight mb-3">NOSSOS PASSEIOS</h2>
            <p className="text-gray-600 text-lg md:text-xl font-medium max-w-2xl mx-auto">Escolha como quer viver o paraíso</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {tours.map((tour, idx) => (
              <div key={tour.id} className="relative group rounded-3xl p-[2px] ctc-aurora-border ctc-aurora-glow flex transform-gpu will-change-transform transition-transform duration-300 hover:-translate-y-1">
                <div className="relative flex-1 bg-gradient-to-br from-[#1BA8B8] to-[#0D8A99] rounded-3xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col group-hover:shadow-2xl">
                  <div className="pointer-events-none absolute inset-0 opacity-30 group-hover:opacity-100 transition-opacity duration-500 ctc-spotlight" />
                  <div className="pointer-events-none absolute -inset-[60%] opacity-0 group-hover:opacity-100 transition-opacity duration-700 ctc-sheen" />

                  {tour.badge && (
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-[#FFD700] text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wide">
                        {tour.badge}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-center pt-8 pb-4">
                    <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-full overflow-hidden ring-8 ring-white/30 shadow-2xl">
                      <Image
                        src={tour.image}
                        alt={tour.title}
                        fill
                        sizes="(max-width: 768px) 224px, 256px"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        quality={100}
                        priority={idx < 3}
                      />
                    </div>
                  </div>

                  <div className="px-6 pb-6 flex flex-col flex-1 text-white text-center">
                    <h3 className="text-2xl md:text-3xl font-black mb-2 leading-tight uppercase tracking-tight">{tour.title}</h3>
                    
                    <div className="inline-block bg-[#FFD700] text-black text-xs font-bold px-4 py-1 rounded-full mx-auto mb-3 shadow-md">
                      {tour.subtitle}
                    </div>
                    
                    <p className="text-base mb-4 font-medium">{tour.description}</p>

                    <div className="flex flex-wrap justify-center gap-3 mb-4 text-sm">
                      {tour.duration && (
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span>{tour.duration}</span>
                        </div>
                      )}
                      {tour.difficulty && (
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>{tour.difficulty}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto">
                      <div className="bg-white/20 rounded-2xl p-4 mb-4 backdrop-blur-sm">
                        <div className="text-sm font-medium mb-1 opacity-90">A partir de</div>
                        <div className="text-3xl font-black tracking-tight">{tour.startingAt}</div>
                        {tour.oldPrice && (
                          <div className="text-sm line-through opacity-70 mt-1">{tour.oldPrice}</div>
                        )}
                        <div className="text-xs opacity-90 mt-1">por {tour.unit}</div>
                      </div>
                      
                      <Link
                        href={`${whatsappLink}?text=${encodeURIComponent(tour.whatsappMessage)}`}
                        target="_blank"
                        className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-[#1BA8B8] font-black py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 text-base shadow-xl uppercase tracking-wide"
                      >
                        <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Ver disponibilidade
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 md:mt-16 bg-gray-50 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-lg border border-gray-100">
            <h3 className="text-xl md:text-2xl font-heading text-[#0a4d54] mb-4 md:mb-6 text-center tracking-wide">MAIS SERVIÇOS</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {moreServices.map((service, i) => (
                <Link
                  key={i}
                  href={`${whatsappLink}?text=${encodeURIComponent(`Olá! Quero saber sobre ${service.name}`)}`}
                  target="_blank"
                  className="bg-white hover:bg-[#0a4d54] hover:text-white p-3 md:p-4 rounded-xl text-center transition-all group border border-gray-100 active:scale-[0.98]"
                >
                  <p className="font-bold text-xs md:text-sm group-hover:text-white text-[#0a4d54]">{service.name}</p>
                  <p className="text-[10px] md:text-xs text-gray-500 group-hover:text-cyan-200 mt-1">{service.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="galeria" className="py-16 md:py-24 bg-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-8 md:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <span className="text-[#25D366] font-bold text-xs md:text-sm uppercase tracking-widest">Momentos</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading text-[#0a4d54] mt-1 md:mt-2 tracking-wide">GALERIA</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(galleryRef, 'left')} className="p-2.5 md:p-3 rounded-full bg-white shadow-md border hover:bg-gray-100 transition active:scale-95">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-[#0a4d54]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => scroll(galleryRef, 'right')} className="p-2.5 md:p-3 rounded-full bg-white shadow-md border hover:bg-gray-100 transition active:scale-95">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-[#0a4d54]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div ref={galleryRef} className="flex gap-3 md:gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {Array.from(new Set(galleryImages)).map((img, i) => (
            <div
              key={img}
              className="min-w-[280px] w-[280px] sm:min-w-[320px] sm:w-[320px] md:min-w-[380px] md:w-[380px] h-[280px] sm:h-[320px] md:h-[380px] relative rounded-2xl md:rounded-3xl overflow-hidden shadow-xl snap-center flex-shrink-0"
            >
              <Image
                src={img}
                alt={`Galeria ${i + 1}`}
                fill
                quality={100}
                sizes="(max-width: 768px) 320px, 380px"
                className="object-cover saturate-125 contrast-110 brightness-105 hover:saturate-150 hover:scale-105 transition-all duration-500"
              />
            </div>
          ))}
        </div>
      </section>

      <section id="depoimentos" className="py-16 md:py-24 bg-gray-50 text-gray-900 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-8 md:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <span className="text-[#25D366] font-bold text-xs md:text-sm uppercase tracking-widest">Avaliações</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading text-[#0a4d54] mt-1 md:mt-2 tracking-wide">DEPOIMENTOS</h2>
            <p className="text-gray-500 text-xs md:text-sm mt-1">+500 avaliações 5 estrelas</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(testimonialRef, 'left')} className="p-2.5 md:p-3 rounded-full bg-white shadow-md border hover:bg-gray-100 transition active:scale-95">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-[#0a4d54]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => scroll(testimonialRef, 'right')} className="p-2.5 md:p-3 rounded-full bg-white shadow-md border hover:bg-gray-100 transition active:scale-95">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-[#0a4d54]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div ref={testimonialRef} className="flex gap-3 md:gap-4 overflow-x-auto px-4 pb-4 snap-x scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {testimonials.map((t, i) => (
            <div key={i} className="min-w-[260px] sm:min-w-[280px] md:min-w-[300px] bg-white p-4 md:p-6 rounded-xl md:rounded-2xl snap-start flex-shrink-0 border border-gray-100 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                {t.image ? (
                  <Image src={t.image} alt={t.name} width={48} height={48} className="rounded-full border-2 border-[#25D366] w-12 h-12 object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm ${['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500'][i % 5]
                    }`}>
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-[#0a4d54] text-sm md:text-base">{t.name}</p>
                  <p className="text-[10px] md:text-xs text-gray-500">{t.city}</p>
                </div>
              </div>
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <p className="text-xs md:text-sm text-gray-600 italic">&quot;{t.text}&quot;</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-[#25D366] font-bold text-xs md:text-sm uppercase tracking-widest">Sobre Nós</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading text-[#0a4d54] mt-1 md:mt-2 tracking-wide">CALEB&apos;S TOUR</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="flex justify-center">
              <Image
                src="/logo-caleb-tour.jpg"
                alt="Caleb's Tour Co."
                width={300}
                height={300}
                className="rounded-full shadow-2xl w-[200px] h-[200px] md:w-[280px] md:h-[280px] lg:w-[350px] lg:h-[350px] object-cover"
                quality={100}
                loading="lazy"
              />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-heading text-[#0a4d54] mb-3 md:mb-4 tracking-wide">O CARIBE BRASILEIRO É AQUI!</h3>
              <p className="text-gray-600 mb-4 md:mb-6 leading-relaxed text-sm md:text-base">
                A <strong>Caleb&apos;s Tour Company (CTC)</strong> é referência em turismo na Região dos Lagos do Rio de Janeiro.
                Oferecemos experiências inesquecíveis em Arraial do Cabo, Búzios e Cabo Frio, conectando você às águas mais cristalinas do Brasil.
              </p>
              <p className="text-gray-600 mb-4 md:mb-6 leading-relaxed text-sm md:text-base">
                Nossa equipe é apaixonada por proporcionar momentos únicos: desde o clássico passeio de barco pelo Caribe Brasileiro,
                até aventuras de quadriciclo nas dunas, mergulhos inesquecíveis e muito mais.
              </p>

              <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-100">
                <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                  <div>
                    <p className="text-gray-500">Razão Social</p>
                    <p className="font-bold text-[#0a4d54]">Caleb&apos;s Tour Company</p>
                  </div>
                  <div>
                    <p className="text-gray-500">CNPJ</p>
                    <p className="font-bold text-[#0a4d54]">26.096.072/0001-78</p>
                  </div>
                  <div>
                    <p className="text-gray-500">WhatsApp</p>
                    <p className="font-bold text-[#0a4d54]">(22) 99824-9911</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Instagram</p>
                    <p className="font-bold text-[#0a4d54]">@calebstour</p>
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
                  <p className="text-gray-500 text-xs md:text-sm">Endereço</p>
                  <p className="font-medium text-[#0a4d54] text-xs md:text-sm">Travessa Beija-Flor, Jacaré - Cabo Frio, RJ</p>
                </div>
              </div>

              <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href={whatsappLink}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-3 px-6 rounded-full transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  Fale Conosco
                </Link>
                <Link
                  href="https://instagram.com/calebstour"
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 border-2 border-[#0a4d54] text-[#0a4d54] hover:bg-[#0a4d54] hover:text-white font-bold py-3 px-6 rounded-full transition-all text-sm md:text-base"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                  Instagram
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#052e32] text-white py-10 md:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-4">
              <Image src="/logo-ctc.png" alt="Logo" width={50} height={50} className="rounded-full w-12 h-12 md:w-[60px] md:h-[60px]" quality={100} loading="lazy" />
              <div>
                <p className="font-heading text-base md:text-lg tracking-wide">Caleb&apos;s Tour Company</p>
                <p className="text-xs md:text-sm text-cyan-400">O Caribe Brasileiro é aqui!</p>
              </div>
            </div>
            <div className="flex gap-3 md:gap-4">
              <Link href={whatsappLink} target="_blank" className="w-10 h-10 bg-white/10 hover:bg-[#25D366] rounded-full flex items-center justify-center transition-all active:scale-95">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </Link>
              <Link href="https://instagram.com/calebstour" target="_blank" className="w-10 h-10 bg-white/10 hover:bg-pink-600 rounded-full flex items-center justify-center transition-all active:scale-95">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </Link>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs md:text-sm text-gray-400">
            <div className="text-center md:text-left">
              <p>CNPJ: 26.096.072/0001-78</p>
              <p>Travessa Beija-Flor, Jacaré - Cabo Frio, RJ</p>
            </div>
            <p className="text-center">© 2025 Caleb&apos;s Tour Company. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <Link
        href={whatsappLink}
        target="_blank"
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-[#25D366] hover:bg-[#1da851] text-white p-3 md:p-4 rounded-full shadow-2xl z-50 transition-all hover:scale-110 active:scale-95"
      >
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </Link>
    </main>
  );
}
