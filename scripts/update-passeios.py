#!/usr/bin/env python3
"""
Script para atualizar passeios no banco de dados Supabase
com informações reais do site concorrente
"""

import os
import sys
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Conecta ao Supabase usando variáveis de ambiente"""
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Erro: Variáveis de ambiente não configuradas!")
        print("   Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def update_passeios(supabase: Client):
    """Atualiza ou insere passeios no banco de dados"""
    
    passeios = [
        {
            'id': 'bd2c64ee-8900-48e9-9512-930dc44041ce',
            'nome': 'Passeio de Barco com Toboágua - Arraial do Cabo',
            'categoria': 'Passeio de Barco',
            'descricao': 'Embarcação exclusiva de 2 andares com toboágua, banheiros, bar, petiscos, música e animação. Tour com duração média de 4h pelas principais praias e pontos naturais do Caribe Brasileiro. Roteiro: Pier Praia dos Anjos (embarque), Ilha do Farol (parada), Pedra do Macaco (vista), Fenda da Nossa Senhora (vista), Gruta Azul (vista), Prainhas Pontal do Atalaia (vista), Praia do Forno (parada). Taxa de embarque R$10,00 não inclusa.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '4 horas',
            'preco_min': 59.90,
            'preco_max': 59.90,
            'includes': '02 Andares, Toboágua, Balanço, Bóias, Animador, Música ambiente, Bolas flutuadoras, Água mineral durante o passeio.'
        },
        {
            'id': '8a3c54fa-9900-48e9-9512-930dc44041aa',
            'nome': 'Passeio de Barco Open Bar + Open Food - Arraial',
            'categoria': 'Passeio de Barco',
            'descricao': 'Embarcação exclusiva de 2 andares com banheiros, bar, churrasco liberado, bebida liberada, petiscos, fotografia, música e animação. Tour com duração média de 4h pelas principais praias e pontos naturais do Caribe Brasileiro. Roteiro igual ao passeio tradicional. Taxa de embarque R$10,00 não inclusa.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '4 horas',
            'preco_min': 169.90,
            'preco_max': 250.00,
            'includes': '02 Andares, Toboágua, Animador, Música ambiente, Boias flutuadoras, Bebida Liberada, Churrasco Liberado, Almoço buffet livre em restaurante.'
        },
        {
            'id': '20d2e3f1-6a41-4a31-854a-176f71dd7e10',
            'nome': 'Quadriciclo Automático com Direção Elétrica',
            'categoria': 'Aventura Off-Road',
            'descricao': 'Quadriciclo automático com direção elétrica para 2 pessoas. Fácil de pilotar, a partir de 7 anos. Você pilota! Inclui fotos no Crau, parada para mergulho, guia local e estacionamento.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '2 horas',
            'preco_min': 200.00,
            'preco_max': 300.00,
            'includes': 'Quadriciclo automático, Direção elétrica, Capacidade: 2 pessoas, Foto no Crau, Parada para Mergulho, Guia Local, Estacionamento'
        },
        {
            'id': 'fdaa7c3d-e127-41ef-bc32-d3637f71a17e',
            'nome': 'Passeio de Buggy - Roteiro Tradicional',
            'categoria': 'Aventura Off-Road',
            'descricao': 'Passeio de buggy por 04 praias e 01 lagoa em Arraial do Cabo. Fácil e confortável para até 2 pessoas.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '2 horas',
            'preco_min': 250.00,
            'preco_max': 300.00,
            'includes': '04 Praias + 01 Lagoa, Foto nos Pontos, Parada para Mergulho, Estacionamento, Banheiro, Guia Local'
        },
        {
            'id': '1ff413e0-5163-4214-99e2-a419cd594b36',
            'nome': 'Passeio de Buggy - Roteiro Arubinha',
            'categoria': 'Aventura Off-Road',
            'descricao': 'Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo! Praia Branca, parada para mergulho, trilha selvagem.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '4 horas',
            'preco_min': 550.00,
            'preco_max': 550.00,
            'includes': 'Praia Branca, Parada para Mergulho, Trilha Selvagem, Estacionamento, Banheiro, Guia Local'
        },
        {
            'id': '407de9cd-f9f9-46d3-bf36-0aa9461e97a2',
            'nome': 'Buggy Exclusivo com Fotos - 7 horas',
            'categoria': 'Aventura Off-Road',
            'descricao': 'UM DIA EM ARRAIAL! Explore as belezas de Arraial do Cabo em um emocionante passeio de buggy com fotos, mergulhos e um pôr do sol inesquecível! Saídas às 07:30h.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '7 horas',
            'preco_min': 1200.00,
            'preco_max': 1200.00,
            'includes': 'Fotos Gratuitas, Parada para Mergulho, Estacionamento, Banheiro, Guia Local'
        },
        {
            'id': '9f00a217-011f-4b70-a08d-bb32c0a6e593',
            'nome': 'Mergulho com Cilindro',
            'categoria': 'Mergulho',
            'descricao': 'Um paraíso debaixo d\'água! Mergulhe com as tartarugas! Inclui fotos subaquáticas! A partir de 10 anos. Não precisa saber nadar.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '40 minutos de mergulho',
            'preco_min': 300.00,
            'preco_max': 320.00,
            'includes': 'Equipamento completo, Instrutor, Fotos Gratuitas subaquáticas, Kit Lanche'
        },
        {
            'id': '5f00a217-011f-4b70-a08d-bb32c0a6e594',
            'nome': 'Mergulho de Snorkel',
            'categoria': 'Mergulho',
            'descricao': '02 horas admirando tartarugas marinhas! Não precisa saber nadar!',
            'local': 'Arraial do Cabo, RJ',
            'duracao': '60 minutos',
            'preco_min': 120.00,
            'preco_max': 180.00,
            'includes': 'Equipamento completo, Instrutor, Fotos Gratuitas, Trilha'
        },
        {
            'id': '6f00a217-011f-4b70-a08d-bb32c0a6e595',
            'nome': 'Combo Barco + Quadriciclo (2 pessoas)',
            'categoria': 'Combo',
            'descricao': 'Passeio de Barco com Toboágua (04 horas) + Passeio de Quadriciclo (Você pilota! Parada para fotos. Trilha off-road. Estacionamento grátis). Você poderá realizar os passeios no mesmo dia ou em dias diferentes! Flexível.',
            'local': 'Arraial do Cabo, RJ',
            'duracao': 'Dia inteiro',
            'preco_min': 300.00,
            'preco_max': 450.00,
            'includes': 'Passeio de Barco com Toboágua 04h + Passeio de Quadriciclo 02h. A partir de 7 anos.'
        },
        {
            'id': '7f00a217-011f-4b70-a08d-bb32c0a6e596',
            'nome': 'City Tour Arraial (Saindo do Rio)',
            'categoria': 'City Tour',
            'descricao': 'Explore o deslumbrante Arraial do Cabo com um emocionante tour de barco, desfrutando de paradas paradisíacas e conforto a bordo! Saídas às 07:00h.',
            'local': 'Saída: Rio de Janeiro - Destino: Arraial do Cabo',
            'duracao': 'Dia inteiro',
            'preco_min': 280.00,
            'preco_max': 320.00,
            'includes': 'Transporte ida e volta, Guia Bilingue, Almoço, Passeio de Barco com Toboágua. Ambiente familiar.'
        }
    ]
    
    print("🔄 Atualizando passeios no banco de dados...")
    print()
    
    success_count = 0
    error_count = 0
    
    for passeio in passeios:
        try:
            # Usar upsert para inserir ou atualizar
            result = supabase.table('passeios').upsert(passeio).execute()
            print(f"✅ {passeio['nome']}")
            print(f"   💰 R$ {passeio['preco_min']:.2f} - R$ {passeio['preco_max']:.2f}")
            print(f"   ⏱️  {passeio['duracao']}")
            print()
            success_count += 1
        except Exception as e:
            print(f"❌ Erro ao atualizar {passeio['nome']}: {e}")
            print()
            error_count += 1
    
    print("=" * 70)
    print(f"✨ Atualização concluída!")
    print(f"   ✅ {success_count} passeios atualizados com sucesso")
    if error_count > 0:
        print(f"   ❌ {error_count} erros")
    print("=" * 70)

def main():
    print("=" * 70)
    print("ATUALIZAÇÃO DE PASSEIOS NO BANCO DE DADOS")
    print("Baseado em: https://arraialsun.com.br/")
    print("=" * 70)
    print()
    
    try:
        supabase = get_supabase_client()
        update_passeios(supabase)
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
