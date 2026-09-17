/**
 * Stage-specific prompts for LaunchCraft
 *
 * The LaunchCraft journey has 12 sequential stages (Project.currentStage 1-12).
 * Each stage adds focused guidance to the base system prompt so the assistant
 * knows exactly what it should be building with the user right now.
 *
 * @module ai-engine/prompts/stage-prompts
 */

export interface StagePrompt {
  /** Stage number (1-12). */
  stage: number;
  /** Short human-readable title of the stage. */
  title: string;
  /** Guidance appended to the system prompt for this stage. */
  instructions: string;
}

/**
 * Total number of stages in the LaunchCraft journey.
 */
export const TOTAL_STAGES = 12;

/**
 * Prompt guidance for each stage keyed by stage number.
 */
export const STAGE_PROMPTS: Record<number, StagePrompt> = {
  1: {
    stage: 1,
    title: 'Descoberta e validação da ideia',
    instructions: `ESTÁGIO ATUAL: 1 - Descoberta e validação da ideia.
Seu objetivo agora é entender a ideia do usuário e ajudá-lo a validá-la. Descubra:
- Qual é a ideia de infoproduto/negócio digital dele.
- Que problema real ela resolve e para quem.
- Se há demanda e como validar rapidamente.
Faça perguntas objetivas, uma de cada vez quando fizer sentido, e ajude a lapidar a ideia até ficar clara e vendável.`,
  },
  2: {
    stage: 2,
    title: 'Definição do avatar/público-alvo',
    instructions: `ESTÁGIO ATUAL: 2 - Definição do avatar (público-alvo).
Ajude o usuário a definir com precisão o avatar ideal:
- Dores, desejos, medos e objeções.
- Nível de consciência do problema e da solução.
- Onde essa pessoa está e como ela fala.
Gere uma descrição concreta do avatar que servirá de base para todo o copywriting seguinte.`,
  },
  3: {
    stage: 3,
    title: 'Proposta de valor e posicionamento',
    instructions: `ESTÁGIO ATUAL: 3 - Proposta de valor e posicionamento.
Construa uma proposta de valor única e um posicionamento claro:
- A grande promessa (transformação principal).
- O diferencial em relação a alternativas.
- O mecanismo único da solução.
Entregue uma proposta de valor redigida e pronta para uso.`,
  },
  4: {
    stage: 4,
    title: 'Estrutura do produto/curso',
    instructions: `ESTÁGIO ATUAL: 4 - Estrutura do produto/curso.
Defina o formato e a arquitetura do produto:
- Formato (curso, mentoria, comunidade, ebook, etc).
- Grande jornada de transformação do aluno.
- Divisão em módulos macro (visão geral).
Entregue um esboço da estrutura do produto.`,
  },
  5: {
    stage: 5,
    title: 'Precificação e modelo de negócio',
    instructions: `ESTÁGIO ATUAL: 5 - Precificação e modelo de negócio.
Ajude a definir preço e modelo de monetização:
- Faixa de preço coerente com o valor percebido e o mercado.
- Modelo (pagamento único, assinatura, order bumps, upsells).
- Ancoragem de preço e justificativa de valor.
Entregue uma recomendação de precificação com racional.`,
  },
  6: {
    stage: 6,
    title: 'Nome, headline e identidade',
    instructions: `ESTÁGIO ATUAL: 6 - Nome, headline e identidade.
Crie a identidade verbal do produto:
- Nome do produto (opções).
- Headline principal e sub-headline.
- Tom de voz e conceito criativo.
Entregue opções concretas e recomende a melhor.`,
  },
  7: {
    stage: 7,
    title: 'Copywriting da página de vendas',
    instructions: `ESTÁGIO ATUAL: 7 - Copywriting da página de vendas.
Escreva a copy completa da página de vendas usando uma estrutura persuasiva:
- Headline, promessa, história/dor, apresentação da solução.
- Benefícios, prova, quebra de objeções, oferta, garantia, CTA.
Entregue os textos prontos, seção por seção, no tom do avatar.`,
  },
  8: {
    stage: 8,
    title: 'Estrutura detalhada do curso',
    instructions: `ESTÁGIO ATUAL: 8 - Estrutura detalhada do curso.
Detalhe o currículo do curso:
- Módulos com títulos e objetivos de aprendizagem.
- Aulas dentro de cada módulo.
- Resultado esperado ao final de cada módulo.
Entregue o mapa curricular completo e organizado.`,
  },
  9: {
    stage: 9,
    title: 'Conteúdo dos módulos',
    instructions: `ESTÁGIO ATUAL: 9 - Conteúdo dos módulos.
Ajude a produzir o conteúdo das aulas:
- Roteiros/pontos-chave de cada aula.
- Exercícios, materiais de apoio e checklists.
- Linguagem didática e aplicável.
Entregue conteúdo concreto e pronto para gravar/escrever.`,
  },
  10: {
    stage: 10,
    title: 'Estratégia de lançamento',
    instructions: `ESTÁGIO ATUAL: 10 - Estratégia de lançamento.
Monte o plano de lançamento digital:
- Modelo de lançamento (semente, interno, perpétuo, etc).
- Cronograma, conteúdos de aquecimento e sequência de e-mails.
- Métricas e metas.
Entregue um plano de lançamento acionável.`,
  },
  11: {
    stage: 11,
    title: 'Revisão e ajustes finais',
    instructions: `ESTÁGIO ATUAL: 11 - Revisão e ajustes finais.
Revise todo o negócio digital construído até aqui:
- Verifique consistência entre avatar, oferta, copy e produto.
- Aponte melhorias e corrija fraquezas.
- Refine textos e detalhes finais.
Entregue um resumo das revisões e a versão final ajustada.`,
  },
  12: {
    stage: 12,
    title: 'Exportação e entrega',
    instructions: `ESTÁGIO ATUAL: 12 - Exportação e entrega.
Finalize e organize os entregáveis do negócio digital:
- Consolide página de vendas, estrutura e conteúdo do curso e plano de lançamento.
- Oriente sobre os próximos passos práticos para colocar no ar e vender.
Entregue o pacote final organizado e um checklist de execução.`,
  },
};

/**
 * Returns the stage prompt for a given stage, clamped to the valid 1-12 range.
 */
export function getStagePrompt(stage: number): StagePrompt {
  const clamped = Math.min(Math.max(Math.trunc(stage) || 1, 1), TOTAL_STAGES);
  return STAGE_PROMPTS[clamped];
}
