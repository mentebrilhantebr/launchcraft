# 🚀 Guia de Setup - LaunchCraft MVP

## Pré-requisitos

- Node.js 20+ 
- Docker & Docker Compose
- Git

## 📦 Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/mentebrilhantebr/launchcraft.git
cd launchcraft
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

O `.env` já vem configurado para desenvolvimento local. Não precisa alterar nada nesta etapa.

### 4. Iniciar banco de dados (PostgreSQL + Redis)

```bash
npm run docker:up
```

Aguarde alguns segundos para o PostgreSQL inicializar completamente.

### 5. Executar migrations

```bash
npm run db:migrate:deploy
```

Isso cria as 8 tabelas do schema.

### 6. Popular banco com dados iniciais

```bash
npm run db:seed
```

Isso cria:
- 2 planos (Gratuito ativo, Pro inativo)
- 3 configurações globais
- 2 templates básicos

### 7. Testar conexão

```bash
npm run db:test
```

Deve exibir ✅ em todos os testes.

### 8. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

## 🛠️ Comandos Úteis

### Desenvolvimento

```bash
npm run dev           # Inicia Next.js em modo dev
npm run build         # Build de produção
npm run start         # Inicia build de produção
npm run lint          # Roda ESLint
```

### Banco de Dados

```bash
npm run db:generate         # Gera Prisma Client
npm run db:migrate          # Cria nova migration
npm run db:migrate:deploy   # Aplica migrations
npm run db:push             # Sincroniza schema (dev apenas)
npm run db:studio           # Abre Prisma Studio (GUI)
npm run db:seed             # Popula dados iniciais
npm run db:test             # Testa conexão
```

### Docker

```bash
npm run docker:up      # Inicia PostgreSQL + Redis
npm run docker:down    # Para containers
npm run docker:logs    # Mostra logs
```

## 📊 Estrutura do Projeto

```
launchcraft/
├── src/
│   ├── app/              # Next.js App Router (páginas)
│   ├── modules/          # 6 módulos principais
│   │   ├── ai-engine/           # Orquestração de IA
│   │   ├── business-generator/  # Geração de negócios
│   │   ├── database/            # Camada de dados (Prisma)
│   │   ├── editor/              # Editor de conteúdo
│   │   ├── interface/           # Componentes UI
│   │   └── renderer/            # Renderização de templates
│   └── lib/              # Bibliotecas de suporte
│       ├── config/
│       ├── security/
│       ├── queue/
│       ├── realtime/
│       ├── storage/
│       ├── monitoring/
│       └── payments/
├── prisma/
│   ├── schema.prisma     # Schema do banco
│   └── migrations/       # Migrations SQL
├── docker-compose.yml    # PostgreSQL + Redis
├── .env                  # Variáveis de ambiente (não commitado)
├── .env.example          # Exemplo de .env
└── package.json
```

## 🔧 Etapas de Construção

- [x] **Etapa 1**: Estrutura base (Next.js + TypeScript + Tailwind)
- [x] **Etapa 2**: Banco de dados (PostgreSQL + Prisma)
- [ ] **Etapa 3**: Autenticação (JWT + hash)
- [ ] **Etapa 4**: Orquestração de IA (LLMs)
- [ ] **Etapa 5**: Fluxo de 12 etapas
- [ ] **Etapa 6**: Fila de tarefas (Redis + BullMQ)
- [ ] **Etapa 7**: Tempo real (SSE)
- [ ] **Etapa 8**: Armazenamento (S3)
- [ ] **Etapa 9**: Visual (Tailwind)
- [ ] **Etapa 10**: Pagamentos (Stripe)
- [ ] **Etapa 11**: Monitoramento (Sentry)
- [ ] **Etapa 12**: Painel Admin

## 🐛 Troubleshooting

### Erro: "Can't reach database server"

```bash
# Certifique-se de que o Docker está rodando
docker ps

# Se não estiver, inicie os containers
npm run docker:up

# Aguarde 10 segundos e teste novamente
npm run db:test
```

### Erro: "relation does not exist"

```bash
# Execute as migrations
npm run db:migrate:deploy
```

### Porta 3000 já está em uso

```bash
# Mude a porta no comando dev
PORT=3001 npm run dev
```

### Porta 5432 já está em uso

Você provavelmente tem outro PostgreSQL rodando. Opções:

1. Pare o PostgreSQL local
2. Ou mude a porta no `docker-compose.yml` e no `.env`

## 📚 Documentação

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

## 🤝 Contribuindo

Este é um MVP em construção. Siga as **12 etapas** na ordem. Cada etapa deve ser validada antes de avançar para a próxima.

## 📄 Licença

Proprietary - © 2026 LaunchCraft
