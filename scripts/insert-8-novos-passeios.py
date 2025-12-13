#!/usr/bin/env python3
"""
Script para inserir os 8 NOVOS passeios que faltam no banco Supabase
Criado em: 13/12/2025
"""
import os
import sys
from supabase import create_client, Client

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variáveis de ambiente não configuradas:")
    print("   NEXT_PUBLIC_SUPABASE_URL")
    print("   SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

NOVOS_PASSEIOS = [
    {
        "nome": "PASSEIO DE BUGGY - ROTEIRO ARUBINHA",
        "categoria": "Aventura Terrestre",
        "descricao": "Excelente opção para quem quer explorar os cantinhos escondidos de Arraial do Cabo!",
        "local": "Arraial do Cabo, RJ",
        "duracao": "4 horas",
        "preco_min": 550.00,
        "preco_max": 550.00,
        "includes": "Buggy completo, roteiro diferenciado com praias escondidas",
        "horarios": "Manhã ou tarde - sob agendamento"
    },
    {
        "nome": "COMBO BARCO + QUADRICICLO AUTOMÁTICO PARA 02 PESSOAS",
        "categoria": "Combo",
        "descricao": "Você poderá realizar os passeios no mesmo dia ou em dias diferentes!",
        "local": "Arraial do Cabo, RJ",
        "duracao": "Flexível",
        "preco_min": 300.00,
        "preco_max": 300.00,
        "includes": "A partir de 7 anos, para 02 pessoas, passeio de barco 4h + quadriciclo 2h",
        "horarios": "Flexível - combine com a equipe"
    },
    {
        "nome": "Buggy Exclusivo com Fotos",
        "categoria": "Aventura Terrestre",
        "descricao": "Explore as belezas de Arraial do Cabo em um emocionante passeio de buggy com fotos, mergulhos e um pôr do sol inesquecível!",
        "local": "Arraial do Cabo, RJ",
        "duracao": "7 horas",
        "preco_min": 1200.00,
        "preco_max": 1200.00,
        "includes": "Guia profissional, fotos profissionais inclusas, paradas para mergulho, pôr do sol",
        "horarios": "Saída às 9h - dia inteiro"
    },
    {
        "nome": "City Tour Arraial do Cabo (Saindo do Rio de Janeiro)",
        "categoria": "City Tour",
        "descricao": "Explore o deslumbrante Arraial do Cabo com um emocionante tour de barco, desfrutando de paradas paradisíacas e conforto a bordo!",
        "local": "Rio de Janeiro → Arraial do Cabo, RJ",
        "duracao": "Dia inteiro",
        "preco_min": 280.00,
        "preco_max": 280.00,
        "includes": "Transporte ida/volta do Rio, passeio de barco completo, guia, ambiente familiar",
        "horarios": "Saída às 6h do Rio de Janeiro"
    },
    {
        "nome": "Passeio de Barco Open Bar + Open Food",
        "categoria": "Passeio de Barco",
        "descricao": "Explore as paisagens deslumbrantes de Arraial do Cabo em um passeio de barco inesquecível com toboágua, open bar e churrasco à vontade!",
        "local": "Arraial do Cabo, RJ",
        "duracao": "aprox. 4 horas",
        "preco_min": 169.90,
        "preco_max": 169.90,
        "includes": "Open bar (bebidas liberadas), open food (churrasco à vontade), toboágua, paradas para mergulho",
        "horarios": "Saída às 10h"
    },
    {
        "nome": "PASSEIO DE BARCO EXCLUSIVO EM ARRAIAL DO CABO",
        "categoria": "Passeio de Barco",
        "descricao": "Família, amigos, churrasco e um barco somente para você!",
        "local": "Arraial do Cabo, RJ",
        "duracao": "4-5 horas",
        "preco_min": 2400.00,
        "preco_max": 2400.00,
        "includes": "Até 10 pessoas, barco exclusivo privativo, guia, churrasco, roteiro personalizado",
        "horarios": "Horário flexível - agende com antecedência"
    },
    {
        "nome": "UM DIA EM ARRAIAL DO CABO",
        "categoria": "Combo",
        "descricao": "TRANSPORTE + PASSEIO DE BARCO + PASSEIO DE QUADRICICLO",
        "local": "Arraial do Cabo, RJ",
        "duracao": "Dia inteiro",
        "preco_min": 900.00,
        "preco_max": 900.00,
        "includes": "Transporte ida e volta, passeio de barco completo 4h, passeio de quadriciclo 2h",
        "horarios": "Saída às 7h - pacote completo"
    },
    {
        "nome": "TRANSFER EXCLUSIVO",
        "categoria": "Transfer",
        "descricao": "Spin 06 passageiros com bancos de couro e ar condicionado.",
        "local": "Região dos Lagos, RJ",
        "duracao": "Flexível",
        "preco_min": 750.00,
        "preco_max": 750.00,
        "includes": "Veículo exclusivo Mercedes Sprinter, até 06 passageiros, ar condicionado, bancos de couro, motorista profissional",
        "horarios": "Sob demanda - 24h"
    }
]

def normalizar(texto):
    """Normaliza texto para comparação"""
    return texto.lower().strip().replace("  ", " ")

def main():
    print("🚀 Inserindo 8 NOVOS passeios no Supabase...\n")
    
    try:
        response = supabase.table('passeios').select('nome').execute()
        nomes_existentes = {normalizar(p['nome']) for p in response.data}
        
        print(f"📊 Total de passeios no banco: {len(nomes_existentes)}\n")
        
        inseridos = 0
        ja_existem = 0
        
        for passeio in NOVOS_PASSEIOS:
            nome_norm = normalizar(passeio['nome'])
            
            if nome_norm in nomes_existentes:
                print(f"⏭️  JÁ EXISTE: {passeio['nome']}")
                ja_existem += 1
                continue
            
            try:
                supabase.table('passeios').insert(passeio).execute()
                print(f"✅ INSERIDO: {passeio['nome']} - R$ {passeio['preco_min']:.2f}")
                inseridos += 1
            except Exception as e:
                print(f"❌ ERRO: {passeio['nome']} - {e}")
        
        print(f"\n{'='*60}")
        print(f"📊 RESUMO:")
        print(f"   ✅ Inseridos: {inseridos}")
        print(f"   ⏭️  Já existiam: {ja_existem}")
        print(f"   📝 Total processados: {len(NOVOS_PASSEIOS)}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
