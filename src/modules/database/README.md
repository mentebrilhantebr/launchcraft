# Módulo 6 — Banco de Dados

**Responsabilidade (Doc. 08):** armazenamento.

Armazena: **usuários, projetos, conversas, feedbacks, templates, configurações, planos, histórico.**

**Nunca armazena informações desnecessárias.**

Nenhuma tabela de marketplace, plugins, equipes ou integrações existe nesta fase (Prompt de Construção do MVP, seção 2).

* `schema/` — schema do banco (Prisma) e migrations

* `repositories/` — acesso a dados (isolamento por usuário obrigatório)