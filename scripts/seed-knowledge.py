import os
from textwrap import dedent
from pathlib import Path
import requests

def load_env_file(path='.env.local'):
    env_path = Path(path)
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())

load_env_file(os.path.join(Path(__file__).resolve().parent.parent, '.env.local'))
load_env_file('.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit('Missing Supabase env vars')

TABLE = 'knowledge_chunks'
endpoint = f"{SUPABASE_URL}/rest/v1/{TABLE}"
headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

chunks = [
    {
        'slug': 'passeios/barco-opcoes-2025',
        'title': 'Passeio de Barco Caleb\'s Tour – opções tradicionais, open bar e open food',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['passeio','barco','valores','arraial'],
        'content': dedent('''\
            Opções oficiais divulgadas no WhatsApp (10/12/2025):
            1) Tradicional – R$150 por pessoa, recepção com frutas e água liberada, embarcação de dois andares com toboágua.
            2) Open Bar – R$180, inclui água, refrigerante e caipirinha liberados, embarcação de um andar.
            3) Open Bar + Open Food – R$280, inclui água, refrigerante, caipirinha, caipvodka, energético, sucos, churrasco com almoço e petiscos, barco de dois andares com toboágua.
            Disponibilidade diária. Crianças de 0 a 4 anos não pagam, de 5 a 7 anos pagam meia. Taxa de embarque municipal R$10 por pessoa (isentos: crianças até 5 anos e idosos 60+).''')
    },
    {
        'slug': 'passeios/barco-open-bar-almoco',
        'title': 'Open Bar + Almoço com churrasco – detalhes de menu e bebidas',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['passeio','barco','gastronomia'],
        'content': dedent('''\
            Embarcações de dois andares com toboágua, duração média de 4h a 4h30.
            Drink list: vodka, energéticos (tradicional, tropical, melancia), caipirinha com cachaça 51 e limão, sucos naturais (melancia, abacaxi, maracujá), refrigerantes e água mineral.
            Opção adicional de cervejas Amstel, Império ou Brahma (R$70 por pessoa, informar na reserva).
            Churrasco completo: contra-filé ou alcatra, carne suína, frango, linguiça; guarnições arroz, vinagrete e farofa com batata.
            Incluso bote de apoio, wi-fi, banheiro, macarrões, bar, fotógrafo opcional e equipamentos exigidos pela Marinha.''')
    },
    {
        'slug': 'politicas/descontos-criancas',
        'title': 'Regras de valores para crianças por passeio',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['politica','criancas','valores'],
        'content': dedent('''\
            Valores NETO informados:
            • Escuna Búzios: 0–5 anos free, 6–10 anos meia.
            • City Tour Arraial do Cabo: 0–5 free, 6–10 meia.
            • City Tour Cabo Frio: 0–4 free, 5–9 meia.
            • City Tour Rio de Janeiro: 0–6 free (mas 6 anos paga almoço), 7+ valor integral.
            • Mergulho: valor integral para qualquer idade.
            • City Tour Buggy Búzios: 0–6 free.
            Observação: pagamentos em cartão de crédito para buggy e lancha possuem acréscimo de 5%.''')
    },
    {
        'slug': 'logistica/transfer-barco',
        'title': 'Transfer Caleb\'s Tour – valores e instruções 2025',
        'source': 'WhatsApp 10/11 e 12/11/2025',
        'tags': ['transfer','logistica','pix'],
        'content': dedent('''\
            Transfer oficial divulgado: R$15 ida + R$15 volta por pessoa (Spin até 6 passageiros). Pagamento via Pix (CNPJ 26.096.072/0001-78, titular Carlos C. S. P., Banco Inter) ao entrar no veículo.
            Solicitar: localização fixa, endereço por escrito, horário desejado e número total de passageiros.
            Proibido embarcar com cooler ou bolsa térmica no transfer. Horários de referência: barco das 10h sai 8h30, barco das 12h sai 10h30.''')
    },
    {
        'slug': 'aventura/checkin-quadriciclo',
        'title': 'Check-in Quadriciclos – Praça Lions Club',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['quadriciclo','checkin','aventura'],
        'content': dedent('''\
            Endereço: Praça Lions Club nº 17, loja 08 – Praia Grande, Arraial do Cabo/RJ. Referência: ao lado da loja Luizinho Autopeças. Tolerância de 15 minutos.
            Obrigações: sapato fechado, CNH para o condutor, óculos de sol, protetor solar, levar água. Aluguel de crocs disponível por R$15.
            Comunicados enviados via WhatsApp reforçam o check-in na agência 30 minutos antes do horário do passeio.''')
    },
    {
        'slug': 'produtos/barco-exclusivo',
        'title': 'Barco exclusivo Caleb\'s Tour – facilidades e cortesias',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['passeio','barco','privativo'],
        'content': dedent('''\
            Oferecido como passeio exclusivo para grupos. Estrutura: tripulação treinada, bancos com almofadas, som com karaokê e Spotify, banheiro, pia/ducha, churrasqueira (preparo incluso), espaguetes, coletes, snorkel, tapete flutuante, balanço/coração instagramável no 2º piso, escorrega e trampolim.
            Cortesia: carvão e gelo. Sem limite de acompanhantes; crianças 0–5 não pagam, 6–9 pagam metade. Valores dependem da data e disponibilidade.''')
    },
    {
        'slug': 'marketing/passeios-49',
        'title': 'Campanha R$49,99 – passeios de barco',
        'source': 'Calebs-Tour.pdf',
        'tags': ['marketing','barco','promocao'],
        'content': dedent('''\
            Material gráfico oficial destaca “Passeio de Barco – Arraial do Cabo, Cabo Frio, Búzios a partir de R$49,99”.
            Inclui chamada “Churrasco e bebidas / cooler”, lista de serviços (barco, buggy, jet ski, quadriciclo, guia de turismo) e contato (22) 99728-5249 + @CalebsTour.
            Usado em reels/feeds para tráfego pago e impressos.''')
    },
    {
        'slug': 'roteiros/arraial-album',
        'title': 'Roteiro Arraial do Cabo – paradas e taxas',
        'source': 'Album-de-fotos.pdf',
        'tags': ['roteiro','arraial','barco'],
        'content': dedent('''\
            Roteiro divulgado: Ilha do Farol, Prainhas do Pontal (Gruta do Amor, escadaria), Fenda de Nossa Senhora, Pedra do Gorila, Buraco do Meteoro, Praia do Forno, Enseada da Praia do Forno.
            Duração média 3h30–4h; “Caribe Brasileiro” com 2–3 paradas de banho.
            Taxa portuária: R$8,00 por pessoa (dinheiro). Isentos: maiores de 60 anos e crianças até 12 (ou 6 dependendo da embarcação).''')
    },
    {
        'slug': 'roteiros/cabo-frio-album',
        'title': 'Roteiro Cabo Frio – pontos visitados e mergulhos',
        'source': 'Album-de-fotos.pdf',
        'tags': ['roteiro','cabo-frio','barco'],
        'content': dedent('''\
            Trajeto padrão: Boulevard Canal, Ilha do Japonês, Praia do Forte, Farol da Lajinha, Praia Brava, Ilha dos Papagaios, Canto do Forte.
            Duração aproximada 2h30–3h, com duas paradas para mergulho (Ilha dos Papagaios e Canto do Forte).''')
    },
    {
        'slug': 'roteiros/buzios-album',
        'title': 'Roteiro Escuna Búzios – 12 praias e 3 ilhas',
        'source': 'Album-de-fotos.pdf',
        'tags': ['roteiro','buzios','escuna'],
        'content': dedent('''\
            Destaques: Praia da Armação, Praia das Moças/Ilha Feia, Praia do Canto, João Fernandes/J.Fernandinho, Praia dos Ossos, Azeda/Azedinha, Tartaruga/Tartaruguinha, Praia dos Amores, Ilha Branca, Ilha do Caboclo etc.
            12 praias + 3 ilhas; 3 paradas para mergulho (Ilha Branca, Ilha do Caboclo, Ilha Feia). Duração 2h30 aprox. Serviço de animação diferenciado e guias a bordo.''')
    },
    {
        'slug': 'institucional/contatos-redes',
        'title': 'Canais oficiais – Caleb\'s Tour Company',
        'source': 'Album-de-fotos.pdf, Folder Calebs',
        'tags': ['contato','institucional'],
        'content': dedent('''\
            Telefones divulgados: (22) 99941-9433, (22) 99980-6719 e (22) 99728-5249.
            Redes sociais: Instagram @CalebsTour, Facebook/YouTube “Caleb’s Tour”.
            Materiais impressos reforçam que a empresa opera passeio de barco, buggy, jet ski, quadriciclo, paramotor, mergulho e serviço de guia credenciado.''')
    },
    {
        'slug': 'citytours/servicos-complementares',
        'title': 'City tours e serviços extras Caleb\'s Tour',
        'source': 'folheto.pdf',
        'tags': ['city-tour','servicos'],
        'content': dedent('''\
            City Tour Rio: Corcovado, Pão de Açúcar, Maracanã, Sambódromo, Leblon, Ipanema, Copacabana (parada para almoço).
            City Tour Cabo Frio: Ilha do Japonês, Praia do Peró, Praia das Conchas, Praia do Forte, Passagem (a pé ou de van; barco-táxi e almoço não inclusos).
            Serviços adicionais: roteiros personalizados, excursões, aluguel de ônibus/vans, city tour privativo para 2 pessoas, piloto/lancha/jet ski próprios, operação em Angra, Paraty e Barra da Tijuca, guias CADASTUR. Roteiros sujeitos a trânsito/clima.''')
    },
    {
        'slug': 'aventura/voucher-quadri',
        'title': 'Exemplo de voucher – Passeio de Quadriciclo automático',
        'source': 'Carlospereira-YCEDDY.pdf',
        'tags': ['quadriciclo','voucher','operacao'],
        'content': dedent('''\
            Voucher emitido em 09/12/2025 às 13h para “Passeio de Quadriciclo automático com direção elétrica”. Check-in: Praça Lions Club nº17, loja 08, Praia Grande (30 min antes). Valor total R$200 com sinal de R$50 já pago e saldo R$150.
            Contato operacional citado: Arraial do Cabo Trips (22) 99716-5945 / arraialsun@gmail.com.''')
    },
    {
        'slug': 'politicas/cancelamento-ctc',
        'title': 'Política de compra, alteração e cancelamento Caleb\'s Tour',
        'source': 'A71009BA-AB9E-4597-88D1-8475E280400D.pdf',
        'tags': ['politica','cancelamento'],
        'content': dedent('''\
            Pagamento: sinal via Pix/transferência; check-in 30 min antes; atrasos representam desistência sem reembolso. Dados de todos os passageiros são obrigatórios.
            Cancelamentos:
            • Feitos no dia ou 1 dia antes: sem reembolso (art. 740 CC).
            • Aviso ≥48h permite alteração de data, sujeito à disponibilidade.
            • Estornos: 15 dias ou mais – 100%; 14 a 2 dias – 50%; menos de 2 dias – sem reembolso.
            Se a Marinha cancelar a saída, reagendamento ou reembolso integral; se interromper após saída, devolução proporcional.
            Taxa de embarque municipal não inclusa. Reembolsos em até 2 dias úteis pelo mesmo meio do pagamento.''')
    },
    {
        'slug': 'passeios/barco-openbar-um-andar',
        'title': 'Passeio de Barco Open Bar (1 andar) – check-in Valentyna',
        'source': 'WhatsApp 10/12/2025',
        'tags': ['passeio','barco','operacao'],
        'content': dedent('''\
            Check-in até 11h no píer da Praia dos Anjos (entrada ao lado do Restaurante Saint Tropez). Operado pela equipe da Embarcação Valentyna; é necessário informar nomes, quitar restante e receber pulseiras.
            Inclui água, refrigerante e caipirinha liberados após a primeira parada. Duração aproximada 4h, com bote de apoio, wi-fi, banheiro, macarrões, bar e fotógrafo opcional. Cooler permitido. Saídas diárias às 11h.''')
    }
]

resp = requests.post(endpoint, headers=headers, json=chunks)
if not resp.ok:
    print(resp.text)
    resp.raise_for_status()
else:
    print('Inserted', len(resp.json()), 'records')
