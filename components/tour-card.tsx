import Link from 'next/link';
import { MessageCircle, CheckCircle } from 'lucide-react';

interface TourCardProps {
  title: string;
  price: string;
  image: string;
  description: string;
  features: string[];
  whatsappMessage: string;
}

export default function TourCard({ title, price, image, description, features, whatsappMessage }: TourCardProps) {
    // Codifica a mensagem para o link do WhatsApp
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappLink = `https://wa.me/5522998249911?text=${encodedMessage}`;

    return (
        <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full group">
            {/* Área da Imagem (Placeholder colorido por enquanto) */}
            <div className="h-56 bg-gradient-to-br from-cyan-400 to-blue-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-all"></div>
                <div className="absolute bottom-0 left-0 p-4 bg-gradient-to-t from-black/80 to-transparent w-full">
                    <span className="text-white font-bold text-lg drop-shadow-md">{price}</span>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 mb-4 flex-grow text-sm">{description}</p>

                {/* Lista de Features */}
                <div className="space-y-2 mb-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-500">
                             <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                             {feature}
                        </div>
                    ))}
                </div>

                {/* Botão de Ação */}
                <Link 
                    href={whatsappLink}
                    target="_blank"
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors gap-2"
                >
                    <MessageCircle className="w-5 h-5" />
                    Reservar Agora
                </Link>
            </div>
        </div>
    );
}
