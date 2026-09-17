# Módulo 6 — Banco de Dados

**Responsabilidade (Doc. 08):** armazenamento.

Armazena: **usuários, projetos, conversas, feedbacks, templates, configurações, planos, histórico.**

**Nunca armazena informações desnecessárias.**

Nenhuma tabela de marketplace, plugins, equipes ou integrações existe nesta fase (Prompt de Construção do MVP, seção 2).

---

## 📦 Stack

- **ORM**: Prisma 7.x
- **Banco**: PostgreSQL 17
- **Pooling**: PgBouncer (em produção)
- **Container**: Docker + Docker Compose

## 🗂️ Schema

O banco possui **8 entidades principais**:

1. **Users** - Usuários do sistema (role: USER | ADMIN)
2. **Plans** - Planos de assinatura (Gratuito, Pro, etc)
3. **Projects** - Projetos de negócio criados pelos usuários
4. **Conversations** - Conversas do chat (12 etapas de criação)
5. **Templates** - Templates de página de vendas e estrutura de curso
6. **Configurations** - Configurações globais e por usuário
7. **Feedbacks** - Feedbacks dos usuários
8. **History** - Histórico de ações (auditoria)

## 🚀 Setup Local

### 1. Iniciar PostgreSQL via Docker

```bash
npm run docker:up
```

Isso inicia:
- PostgreSQL na porta 5432
- Redis na porta 6379 (para Etapa 6)

### 2. Executar Migrations

```bash
npm run db:migrate:deploy
```

### 3. Popular com Dados Iniciais

```bash
npm run db:seed
```

Isso cria:
- 2 planos (Gratuito ativo, Pro inativo)
- 3 configurações globais
- 2 templates básicos

### 4. Testar Conexão

```bash
npm run db:test
```

## 📝 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Cria e aplica nova migration |
| `npm run db:migrate:deploy` | Aplica migrations pendentes |
| `npm run db:push` | Sincroniza schema sem criar migration |
| `npm run db:studio` | Abre Prisma Studio (GUI) |
| `npm run db:seed` | Popula banco com dados iniciais |
| `npm run db:test` | Testa conexão e schema |
| `npm run docker:up` | Inicia containers |
| `npm run docker:down` | Para containers |
| `npm run docker:logs` | Mostra logs dos containers |

## 🔌 Uso no Código

### Importar o cliente

```typescript
import { prisma } from '@/modules/database';
```

### Exemplos de uso

```typescript
// Criar usuário
const user = await prisma.user.create({
  data: {
    email: 'usuario@exemplo.com',
    passwordHash: '...', // Hash bcrypt
    name: 'João Silva',
    role: 'USER',
  },
});

// Buscar projetos do usuário
const projects = await prisma.project.findMany({
  where: { userId: user.id },
  include: {
    conversations: true,
  },
  orderBy: { updatedAt: 'desc' },
});

// Criar conversa
const conversation = await prisma.conversation.create({
  data: {
    projectId: project.id,
    userId: user.id,
    stage: 1,
    messages: [
      { role: 'assistant', content: 'Olá! Vamos começar?', timestamp: new Date() },
      { role: 'user', content: 'Sim!', timestamp: new Date() },
    ],
  },
});
```

## 🔒 Segurança

- ✅ Senhas sempre hasheadas (bcrypt)
- ✅ UUIDs em todas as PKs
- ✅ Foreign keys com ON DELETE CASCADE/SET NULL apropriados
- ✅ Enums para campos com valores fixos
- ✅ Validações no schema (NOT NULL, UNIQUE)

## 🌐 Variáveis de Ambiente

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

- `DATABASE_URL`: usado para queries (via PgBouncer em produção)
- `DIRECT_DATABASE_URL`: usado para migrations (conexão direta)

## 📊 Monitoramento

### Health Check

```typescript
import { healthCheck } from '@/modules/database';

const isHealthy = await healthCheck();
```

### Desconectar (graceful shutdown)

```typescript
import { disconnect } from '@/modules/database';

await disconnect();
```

## 🧪 Testes

O script `test-connection.ts` verifica:

1. ✅ Conexão com PostgreSQL
2. ✅ Health check
3. ✅ Schema (8 tabelas esperadas)
4. ✅ Queries básicas (count)

## 📁 Estrutura do Módulo

```
database/
├── README.md           # Esta documentação
├── client.ts           # Cliente Prisma (singleton)
├── index.ts            # Exports centralizados
├── seed.ts             # Dados iniciais
└── test-connection.ts  # Script de teste
```

## 📚 Documentação Prisma

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [PostgreSQL Extensions](https://www.prisma.io/docs/concepts/components/prisma-schema/postgresql-extensions)