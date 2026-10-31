# Auditoria forense de UX — PR #13 (31/10/2026)

Status: **correções P0 de código aplicadas; validação visual nativa e escopo P1–P4 ainda parciais**.

## Contexto e método

Revisão da branch `feat/studio-2026` do PR #13 contra os relatos de usuários e a especificação *AGATA STUDIO 2026 — FORENSIC UX AUDIT & FULL WORKSPACE REFINEMENT*. Foram inspecionados os controladores JS, templates HTML, CSS, serviços Python, catálogo e testes existentes. Os resultados abaixo descrevem **causas encontradas no código**, e não alegam reprodução manual de um desktop Linux/pywebview neste ambiente. A validação em navegador ocorre via Playwright no workflow GitHub Actions; execução nativa Linux precisa ser repetida fora do CI.

## Matriz de problemas

| Área | Comportamento encontrado na branch original | Causa localizada | Mudança aplicada | Regressão |
| --- | --- | --- | --- | --- |
| Android / Conexões | Linhas de navegação exibidas no Design sem ação do usuário | `showLinks=true` no `designer.js` e renderer embutido em `renderWorkspace()` | Inicializar oculto; módulo `navigation_routes.js` separado, renderizado apenas sob controle explícito e fora do modo Constraint | `tests/android_ui.cjs`; `tests/project_wizard_ui.cjs` |
| Android / Linhas cruzando conteúdo | Paths obtidos do `getBoundingClientRect()` do componente até o topo da tela destino, atravessando telas | Roteamento ancorado em conteúdo interno | Links orientados entre portas externas dos frames com canais ortogonais, offsets para vínculos paralelos, limpeza de SVG ao ocultar | Avaliação em Playwright; posicionamento de telas complexo ainda requer validação visual |
| Android / Constraints | Overlay de navegação e controles de constraint parcialmente dependentes | Ausência de estado comum de visibilidade | Exclusão visual mútua; dados semânticos continuam no modelo; Flow Map independe da visibilidade | `tests/project_wizard_ui.cjs` |
| New Project / Web | Seleção Web coexistia com Empty Activity — Compose | Template Android fixo e chamada `create_project` indiferente à plataforma | Template dinâmico por plataforma; `create_web_project` e navegação `/web` para Web; campos Android ocultos em Web | `tests/project_wizard_ui.cjs` |
| Web / sem projeto | Explorer/biblioteca/canvas vazios, controles desabilitados sem onboarding | `studio.js` desabilitava controles, mas mantinha layout da IDE exposto | Estado `empty`, tela de boas-vindas, criação/importação; estado `error` visível para falhas no carregamento inicial | `tests/project_wizard_ui.cjs`, `tests/native_shell_ui.cjs` |
| Web / Identidade | Editor com paleta escura fixa distinta do Agata | CSS sem tokens de tema | Tokens visuais creme/turquesa/rosa e seleção Sistema/Claro/Escuro **apenas para interface Web Studio** | `tests/project_wizard_ui.cjs` |

## Semântica dos estados

- **Normal / Preview**: vínculos de navegação preservados no projeto, mas sem linhas persistentes sobre o layout.
- **Navegação (Conexões ativo)**: renderiza paths e labels de `onClick` vinculados a Screen; vínculo inválido não gera path.
- **Constraints**: desvincula visualmente navegação e mantém ferramentas de âncora no contexto de seleção.
- **Flow Map**: lê o modelo independentemente dos overlays, inclusive quando Conexões está oculto.
- **Web no-project**: só criação, importação e retorno ao Workspace são ações de projeto disponíveis. Selecionar um modelo não equivale a criar seus arquivos.
- **Web project-ready**: Inspector, Monaco, biblioteca e canvas usam o projeto retornado do backend.

## Escopo comprovado vs. pendente

**Implementado em código nesta revisão:** estados iniciais Web, roteamento do wizard, filtro de templates, toggle de conexões e theme selector Web IDE. Os arquivos foram gravados na branch do PR; as correções são hipóteses implementadas até serem confirmadas por testes de navegador e uso nativo.

**Ainda não implementado neste incremento:** catálogo visual com thumbnails reais para todos os templates, auditoria e incorporação de repositórios externos, redesign completo compartilhado dos editores Android/SVG/Sketch, engine nativo equivalente ao ConstraintLayout Android, sincronização perfeita de código arbitrário, todos os elementos avançados da biblioteca, revisão IHC exaustiva e validação de Android SDK. Os oito templates Web e seis estilos Android permanecem a base original documentada em `STUDIO_2026.md`; não foram importados nesta revisão templates de terceiros.

## Checklist de validação

1. `npm run check:js` — sintaxe dos scripts incluindo `navigation_routes.js`.
2. `node --test tests/*.test.cjs` — regressões de contratos.
3. `npm run test:studio-ui` — integração com Vela + Playwright, incluindo `project_wizard_ui.cjs`.
4. `AGATA_UI_SCRIPT=tests/android_ui.cjs node tests/run_ui.cjs` — navegação e persistência.
5. Desktop Linux real: verificar escala/zoom/pan, Vela WebView, sobreposição de SVG, interações de constraint, Monaco e tema do sistema.
6. Verificação manual em 1366×768, 1440×900, 1920×1080 e com projeto criado/reaberto.
7. Exportar e reimportar projetos Web/Android; confirmar correspondência semântica.

**Critério de encerramento:** não declarar a revisão inteira concluída só porque o workflow passou. O teste humano reproduzível na stack nativa é necessário para confirmar os sintomas originais.

Esta revisão não faz merge automático em `main`.
