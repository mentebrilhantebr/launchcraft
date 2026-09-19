/**
 * Stage-specific prompts for LaunchCraft
 *
 * The LaunchCraft journey follows the 12 stages defined literally in
 * "Documento 04 — Fluxo Inteligente de Construção de Negócios Digitais"
 * (Project.currentStage 1-12). Each stage adds focused guidance to the base
 * system prompt so the assistant knows how to conduct the conversation right
 * now.
 *
 * IMPORTANT (Doc 03 / Doc 09): the assistant NEVER uses a fixed questionnaire.
 * `current_stage` is only a progress indicator over Doc 04's narrative flow —
 * the AI decides adaptively what to ask/do in each stage. There is no fixed
 * form and no rigid required fields.
 *
 * @module ai-engine/prompts/stage-prompts
 */

/**
 * Whether a stage is primarily user-facing (the AI talks to / asks the user)
 * or internal (the AI works "internamente"/"automaticamente" without turning
 * it into a form for the user). Based on Doc 04:
 *  - Etapa 03 "Tudo isso acontece internamente."
 *  - Etapa 05 "a IA monta internamente um plano."
 *  - Etapa 07 "Enquanto conversa (...), a IA também constrói o projeto."
 *  - Etapa 11 "A IA verifica automaticamente."
 */
export type StageKind = 'user' | 'internal';

export interface StagePrompt {
  /** Stage number (1-12). */
  stage: number;
  /** Short human-readable title of the stage (literal from Doc 04). */
  title: string;
  /** Whether the stage is user-facing or happens internally. */
  kind: StageKind;
  /** Guidance appended to the system prompt for this stage. */
  instructions: string;
}

/**
 * Total number of stages in the LaunchCraft journey (Doc 04).
 */
export const TOTAL_STAGES = 12;

/**
 * Prompt guidance for each stage keyed by stage number.
 *
 * The titles are the literal stage names from Documento 04. The instructions
 * paraphrase the intent of each stage into operational guidance for the model,
 * always preserving the core rules (never a form, never skip understanding,
 * never repeat answered questions, always explain decisions).
 */
export const STAGE_PROMPTS: Record<number, StagePrompt> = {
  1: {
    stage: 1,
    title: 'Recepção',
    kind: 'user',
    instructions: `ETAPA ATUAL: 01 - Recepção.
O usuário acabou de abrir a plataforma. A mensagem-guia é:
"Descreva sua ideia e nós construiremos seu negócio digital."
Recepcione de forma limpa e objetiva e aguarde a primeira mensagem do usuário. NÃO crie nada ainda. Apenas convide-o a descrever a ideia dele, de forma acolhedora e sem parecer um formulário.`,
  },
  2: {
    stage: 2,
    title: 'Receber a Ideia',
    kind: 'user',
    instructions: `ETAPA ATUAL: 02 - Receber a Ideia.
O usuário descreve a ideia dele (ex: "quero vender cursos de Minecraft", "quero abrir uma loja de roupas", "quero vender meus ebooks").
Neste momento a IA ainda NÃO cria nada. Ela apenas analisa e acolhe a ideia. Se algo estiver muito vago para entender a essência, confirme com naturalidade — sem questionário. O objetivo é captar a ideia central.`,
  },
  3: {
    stage: 3,
    title: 'Compreensão Inteligente',
    kind: 'internal',
    instructions: `ETAPA ATUAL: 03 - Compreensão Inteligente (interna).
Tudo aqui acontece INTERNAMENTE — não transforme isto em perguntas ao usuário. A partir da ideia, identifique:
- Tipo de negócio
- Objetivo principal
- Público provável
- Complexidade
- Recursos necessários
- Possíveis páginas
- Modelo de monetização
Registre essas conclusões como decisões do projeto. Só fale com o usuário se faltar algo essencial que impeça a compreensão.`,
  },
  4: {
    stage: 4,
    title: 'Perguntas Inteligentes',
    kind: 'user',
    instructions: `ETAPA ATUAL: 04 - Perguntas Inteligentes.
Faça perguntas SOMENTE se necessário. As perguntas NUNCA são fixas — cada projeto gera perguntas diferentes, adaptadas ao tipo de negócio identificado na etapa anterior.
Exemplos de direção (não são um formulário): para curso online pode-se perguntar se já possui o curso, quantos pretende vender, se é produtor ou afiliado, se deseja área de membros; para loja virtual, quantos produtos, se já tem identidade visual, se vende só no Brasil; para landing page, qual o objetivo (captar leads, vender, apresentar empresa).
Nunca repita perguntas já respondidas. Nunca faça perguntas desnecessárias.`,
  },
  5: {
    stage: 5,
    title: 'Planejamento',
    kind: 'internal',
    instructions: `ETAPA ATUAL: 05 - Planejamento (interno).
Antes de criar qualquer página, monte INTERNAMENTE um plano. Organize: estrutura, páginas, categorias, produtos, SEO, conteúdo, objetivos e estratégia. Tudo isso antes da construção. Registre o plano como decisões do projeto.`,
  },
  6: {
    stage: 6,
    title: 'Início da Construção',
    kind: 'user',
    instructions: `ETAPA ATUAL: 06 - Início da Construção.
Agora começa a geração. O usuário acompanha tudo com progresso em tempo real, por exemplo:
✔ Analisando ideia → ✔ Organizando estrutura → ✔ Criando identidade → ✔ Criando páginas → ✔ Escrevendo textos → ✔ Gerando SEO → ✔ Finalizando.
Comece a produzir os primeiros artefatos concretos do negócio conforme o plano, comunicando o progresso.`,
  },
  7: {
    stage: 7,
    title: 'Construção Paralela',
    kind: 'internal',
    instructions: `ETAPA ATUAL: 07 - Construção Paralela.
Enquanto conversa com o usuário, a IA também constrói o projeto e NUNCA pausa completamente o processo. Se o usuário enviar uma nova informação, ADAPTE sem reiniciar tudo. Incorpore ajustes de forma incremental.`,
  },
  8: {
    stage: 8,
    title: 'Pré-visualização',
    kind: 'user',
    instructions: `ETAPA ATUAL: 08 - Pré-visualização.
Enquanto trabalha, mostre uma prévia do negócio. O usuário deve conseguir visualizar: página inicial, produtos, banner, menu, rodapé e estrutura — tudo sendo atualizado automaticamente. Apresente o estado atual do projeto de forma clara.`,
  },
  9: {
    stage: 9,
    title: 'Explicação',
    kind: 'user',
    instructions: `ETAPA ATUAL: 09 - Explicação.
Quando terminar, EXPLIQUE tudo. Exemplos: "O projeto foi estruturado com cinco páginas principais.", "Foi criado um SEO inicial.", "Organizei seus produtos.", "Defini uma estrutura voltada para conversão." O usuário precisa entender o motivo de cada decisão. Nunca entregue um resultado sem explicar.`,
  },
  10: {
    stage: 10,
    title: 'Ajustes',
    kind: 'user',
    instructions: `ETAPA ATUAL: 10 - Ajustes.
Após finalizar, pergunte: "O que você gostaria de alterar?" O usuário responde naturalmente (ex: troque a cor, adicione uma seção, mude o público, crie outra página). Modifique APENAS aquilo que foi solicitado, sem mexer no resto.`,
  },
  11: {
    stage: 11,
    title: 'Refinamento',
    kind: 'internal',
    instructions: `ETAPA ATUAL: 11 - Refinamento (interno).
Depois dos ajustes, verifique AUTOMATICAMENTE: se tudo continua organizado, se não surgiram conflitos, se o SEO permanece consistente e se a navegação continua boa. Corrija internamente o que estiver inconsistente.`,
  },
  12: {
    stage: 12,
    title: 'Finalização',
    kind: 'user',
    instructions: `ETAPA ATUAL: 12 - Finalização.
Entregue: estrutura completa, páginas, conteúdo, SEO, organização, resumo do projeto e próximos passos sugeridos. O usuário deve terminar pensando: "Cheguei aqui apenas com uma ideia e estou saindo com um negócio digital estruturado."`,
  },
};

/**
 * Returns the stage prompt for a given stage, clamped to the valid 1-12 range.
 */
export function getStagePrompt(stage: number): StagePrompt {
  const clamped = Math.min(Math.max(Math.trunc(stage) || 1, 1), TOTAL_STAGES);
  return STAGE_PROMPTS[clamped];
}
