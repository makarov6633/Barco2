'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';

const tours = [
  {
    id: 'barco-arraial',
    title: 'Passeio de Barco - Arraial',
    image: '/ilha-farol-arraial.jpg',
    description: 'O clássico Caribe Brasileiro. Água liberada e roteiro completo por 3h30 a 4h.',
    tiers: [
      { name: 'Tradicional', price: 'R$ 150', detail: 'Frutas + Água' },
      { name: 'Open Bar', price: 'R$ 180', detail: 'Água, Refri, Caipirinha' },
      { name: 'Open Food', price: 'R$ 280', detail: 'Tudo + Churrasco' },
    ],
    features: [
      'Recepção com frutas e água + bebidas liberadas conforme plano',
      'Taxa municipal R$ 10 (dinheiro) e bote de apoio para os desembarques',
      'Wi-Fi, banheiro, salva-vidas e toboágua em dois andares'
    ],
    childPolicy: '0-4 anos: Grátis | 5-7 anos: Meia',
    whatsappMessage: 'Olá! Quero agendar o Passeio de Barco em Arraial!'
  },
  {
    id: 'barco-buzios',
    title: 'Escuna - Búzios',
    image: '/escuna-buzios.jpg',
    description: 'Visite 12 praias e 3 ilhas na charmosa Armação dos Búzios.',
    price: 'Consulte',
    features: [
      '12 praias + 3 ilhas com 3 paradas de mergulho (Ilha Branca, Caboclo, Ilha Feia)',
      'Taxa portuária R$ 8 em dinheiro e animação guiada a bordo',
      'Duração média: 2h30'
    ],
    childPolicy: '0-5 anos: Grátis | 6-10 anos: Meia',
    whatsappMessage: 'Olá! Quero saber sobre a Escuna em Búzios!'
  },
  {
    id: 'barco-cabofrio',
    title: 'Passeio de Barco - Cabo Frio',
    image: '/barco-cabofrio-real.jpg',
    description: 'Explore a história e as águas cristalinas de Cabo Frio.',
    price: 'Consulte',
    features: [
      'Boulevard Canal, Ilha do Japonês, Praia do Forte e Forte São Mateus',
      '2 paradas para mergulho (Ilha dos Papagaios e Canto do Forte)',
      'Duração: 2h30 a 3h com embarque no canal'
    ],
    childPolicy: '0-5 anos: Grátis | 6-10 anos: Meia',
    whatsappMessage: 'Olá! Quero saber sobre o Barco em Cabo Frio!'
  },
  {
    id: 'quadriciclo',
    title: 'Quadriciclo',
    image: '/quadriciclo-dunas.jpg',
    description: 'Adrenalina nas dunas e lagoas. Fotos e vídeos GoPro inclusos!',
    price: 'R$ 200',
    features: [
      'Check-in Praça Lions Club nº17 (Praia Grande) com tolerância de 15 min',
      'Roteiro: Pedreira, Lagoa Vermelha, Praia Grande, Pontal do Atalaia',
      'Uso obrigatório de sapato fechado e CNH; aluguel de crocs R$15'
    ],
    childPolicy: 'Por quadriciclo',
    whatsappMessage: 'Olá! Quero agendar o Quadriciclo!'
  },
  {
    id: 'buggy',
    title: 'Passeio de Buggy',
    image: '/buggy-dunas-new.jpg',
    description: 'Passeio 4x4 panorâmico com paradas para banho, fotos e mirantes incríveis.',
    price: 'R$ 250',
    features: ['Roteiro: Prainha, Pontal, lagoas e Praia Grande', 'Ideal para curtir o pôr do sol (tarde)', 'Duração média: 2h com guia'],
    childPolicy: '02 pessoas',
    whatsappMessage: 'Olá! Quero reservar o Passeio de Buggy!'
  },
  {
    id: 'arubinha-buggy',
    title: 'Arubinha de Buggy',
    image: '/buggy-dunas-new.jpg',
    description: 'Passeio exclusivo de buggy pela região com roteiro completo e aventura off-road.',
    price: 'R$ 550',
    features: ['Roteiro completo pela região', 'Fotos e vídeos inclusos', 'Duração: 7 horas de aventura'],
    childPolicy: 'Por buggy',
    whatsappMessage: 'Olá! Quero reservar a Arubinha de Buggy!'
  },
  {
    id: 'mergulho',
    title: 'Mergulho de Batismo',
    image: '/mergulho-arraial.jpg',
    description: 'Experiência subaquática segura. Não precisa saber nadar!',
    price: 'R$ 300',
    features: ['Instrutor exclusivo', 'Fotos subaquáticas inclusas', 'Idade mínima: 10 anos (valor integral)'],
    childPolicy: 'Por pessoa',
    whatsappMessage: 'Olá! Quero agendar o Mergulho!'
  },
  {
    id: 'jet-ski',
    title: 'Jet Ski',
    image: '/WhatsApp-Image-2025-12-10-at-01.34.08.jpeg',
    description: 'Velocidade e liberdade nas águas turquesas.',
    price: 'Consulte',
    features: ['Equipamentos novos e roteiro pelo Canal Itajuru', 'Colete e instrutor incluso', 'Piloto mínimo 18 anos | passageiro a partir de 10 anos'],
    whatsappMessage: 'Olá! Quero saber sobre o Jet Ski!'
  },
  {
    id: 'rio-de-janeiro',
    title: 'City Tour Rio',
    image: '/rio-cristo.jpg',
    description: 'Bate-volta completo pela Cidade Maravilhosa, com roteiro clássico e paradas estratégicas.',
    price: 'Consulte',
    features: ['Cristo Redentor, Pão de Açúcar e pontos clássicos', 'Copacabana, Ipanema, Leblon e parada para almoço', 'Transporte executivo + guia credenciado'],
    childPolicy: '0-6 anos: Grátis (6 paga almoço) | 7+: Integral',
    whatsappMessage: 'Olá! Quero saber sobre o Tour Rio de Janeiro!'
  },
  {
    id: 'lancha',
    title: 'Lancha Privada',
    image: '/954288_2dc6b461184a4c15a1098187cfbf6eb7~mv2.avif',
    description: 'Experiência VIP: lancha exclusiva para seu grupo, com conforto, privacidade e roteiro personalizado.',
    price: 'Sob consulta',
    features: ['Churrasqueira a bordo (carvão + gelo cortesia)', 'Ducha de água doce, snorkel e tapete flutuante', 'Karaokê/Spotify + balanço instagramável no 2º piso (quando disponível)'],
    whatsappMessage: 'Olá! Quero saber sobre a Lancha Privada!'
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
  '/EM7_2585-01.jpeg',
  '/EM7_2942-01.jpeg',
  '/EM7_7961-01 (1).jpeg',
  '/EM7_6768-02.jpeg',
  '/ilha-farol-arraial.jpg',
  '/vista-buzios.jpg',
  '/escuna-proa.jpg',
  '/lancha-privada-real.jpg',
  '/barco-cabofrio-real.jpg',
  '/agua-liberada.jpg',
  '/barco-toboagua.jpg',
  '/mergulho-arraial.jpg',
  '/escuna-buzios.jpg',
  '/cais-praia-anjos.jpg',
  '/quadriciclo-dunas.jpg',
  '/buggy-dunas-new.jpg',
  '/WhatsApp-Image-2025-12-10-at-01.34.08.jpeg',
  '/WhatsApp-Image-2025-12-10-at-01.43.40.jpeg',
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
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/WhatsApp%20Video%202025-12-10%20at%2001.18.34.mp4" type="video/mp4" />
          <source src="/hero-video.mp4" type="video/mp4" />
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
          <div className="text-center mb-10 md:mb-16">
            <span className="text-[#25D366] font-bold text-xs md:text-sm uppercase tracking-widest">Experiências</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading text-[#0a4d54] mt-1 md:mt-2 tracking-wide">NOSSOS PASSEIOS</h2>
            <p className="text-gray-500 mt-3 md:mt-4 max-w-xl mx-auto text-sm md:text-base">Escolha como quer viver o paraíso</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {tours.map((tour) => (
              <div key={tour.id} className="group bg-white rounded-2xl md:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 flex flex-col">
                <div className="relative h-48 sm:h-52 md:h-56 overflow-hidden">
                  <Image
                    src={tour.image}
                    alt={tour.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                    quality={85}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                  <h3 className="absolute bottom-3 md:bottom-4 left-3 md:left-4 right-3 text-xl md:text-2xl font-heading text-white tracking-wide">{tour.title}</h3>
                </div>

                <div className="p-4 md:p-6 flex flex-col flex-1">
                  <p className="text-gray-600 mb-3 md:mb-4 text-sm">{tour.description}</p>

                  {tour.tiers ? (
                    <div className="mb-3 md:mb-4 space-y-2 bg-gradient-to-br from-cyan-50 to-teal-50 p-3 md:p-4 rounded-xl text-sm border border-cyan-100">
                      {tour.tiers.map((t, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="font-medium text-[#0a4d54]">{t.name}</span>
                          <span className="text-[#25D366] font-bold">{t.price}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3 md:mb-4 bg-gradient-to-br from-cyan-50 to-teal-50 p-3 md:p-4 rounded-xl text-center border border-cyan-100">
                      <span className="text-[#0a4d54] font-bold text-base md:text-lg">{tour.price}</span>
                    </div>
                  )}

                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-600 flex-1 mb-3 md:mb-4">
                    {tour.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#25D366] font-bold">✓</span> {f}
                      </li>
                    ))}
                  </ul>

                  {tour.childPolicy && (
                    <div className="mb-3 md:mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                      <span>👶</span>
                      <span>{tour.childPolicy}</span>
                    </div>
                  )}

                  <Link
                    href={`${whatsappLink}?text=${encodeURIComponent(tour.whatsappMessage)}`}
                    target="_blank"
                    className="w-full bg-[#0a4d54] hover:bg-[#073538] text-white font-bold py-2.5 md:py-3 rounded-xl text-center transition-all active:scale-[0.98] text-sm md:text-base"
                  >
                    Reservar
                  </Link>
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

        <div ref={galleryRef} className="flex gap-3 md:gap-4 overflow-x-auto px-4 pb-4 snap-x scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {galleryImages.map((img, i) => (
            <div key={i} className="min-w-[260px] sm:min-w-[300px] md:min-w-[400px] h-[200px] sm:h-[240px] md:h-[280px] relative rounded-xl md:rounded-2xl overflow-hidden shadow-lg snap-start flex-shrink-0 group">
              <Image
                src={img}
                alt={`Galeria ${i}`}
                fill
                sizes="(max-width: 768px) 80vw, (max-width: 1280px) 40vw, 400px"
                className="object-cover group-hover:scale-110 transition-transform duration-700"
                loading="lazy"
                quality={85}
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
                src="/logo-ctc.png"
                alt="Caleb's Tour Co."
                width={250}
                height={250}
                className="rounded-full shadow-2xl w-[180px] h-[180px] md:w-[250px] md:h-[250px] lg:w-[300px] lg:h-[300px]"
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
