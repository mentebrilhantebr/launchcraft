# Módulo 2 — Motor da IA

**Responsabilidade (Doc. 08):** é o cérebro do sistema.

Responsável por: interpretar pedidos, fazer perguntas, planejar, gerar negócio, criar estrutura, tomar decisões, explicar raciocínio, adaptar respostas.

**Nunca desenha a interface.** Apenas gera informações.

- `orchestration/` — camada de orquestração de IA **desacoplada de fornecedor** (permite trocar de modelo sem reescrever o sistema — essencial para V2/V3)
- `prompts/` — prompts do sistema (comportamento de consultor, Doc. 03 e 09)
