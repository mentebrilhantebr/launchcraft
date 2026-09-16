# Módulos do Sistema (Documento 08 — Arquitetura Técnica)

A plataforma é composta por **seis grandes módulos**, cada um com responsabilidade única.
Os módulos **nunca acessam diretamente uns aos outros** — toda comunicação segue o fluxo
organizado: Chat → IA → Gerador → Renderizador → Editor.

| Módulo | Pasta | Responsabilidade |
|---|---|---|
| 1. Interface do Usuário | `src/modules/interface` | Toda interação: tela inicial, chat, visualização do projeto, editor, configurações, feedback, tema claro/escuro. **Não contém inteligência** — apenas apresenta informações. |
| 2. Motor da IA | `src/modules/ai-engine` | Cérebro do sistema: interpretar pedidos, fazer perguntas, planejar, gerar negócio, criar estrutura, tomar decisões, explicar raciocínio, adaptar respostas. **Nunca desenha a interface** — apenas gera informações. |
| 3. Gerador de Negócios | `src/modules/business-generator` | Recebe o planejamento da IA e transforma em: estrutura do negócio, páginas, categorias, produtos, organização, fluxo, SEO, hierarquia. |
| 4. Renderizador | `src/modules/renderer` | Recebe a estrutura e transforma em páginas reais: HTML, CSS, componentes, layouts, responsividade, botões, formulários, cabeçalhos, rodapés. **Apenas constrói — não pensa.** |
| 5. Editor | `src/modules/editor` | Permite ao usuário modificar qualquer parte: textos, imagens, cores, botões, seções, excluir elementos, mover componentes. |
| 6. Banco de Dados | `src/modules/database` | Armazena: usuários, projetos, conversas, feedbacks, templates, configurações, planos, histórico. **Nunca armazena informações desnecessárias.** |

## Princípios da arquitetura (Doc. 08)

1. **Simplicidade** — a solução mais simples que mantenha qualidade.
2. **Modularidade** — cada parte com uma responsabilidade específica; nenhum módulo faz a função de outro.
3. **Escalabilidade** — estrutura permite crescimento futuro sem reescrever o sistema.
4. **Organização** — arquivos separados por responsabilidade, nunca misturados.
5. **Performance** — evitar processamento desnecessário, reutilizar informações, evitar geração duplicada.

## Bibliotecas de suporte (`src/lib`)

- `config` — configuração geral (variáveis de ambiente, constantes)
- `security` — autenticação, hash de senha, JWT, isolamento de dados
- `queue` — fila de tarefas (Redis + BullMQ)
- `realtime` — progresso em tempo real (SSE)
- `storage` — armazenamento de arquivos (S3)
- `monitoring` — monitoramento de erros (Sentry)
- `payments` — pagamentos (Stripe)
