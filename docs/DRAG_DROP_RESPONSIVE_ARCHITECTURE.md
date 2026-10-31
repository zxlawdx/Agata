# Drag & drop e responsividade — IR v2

## Auditoria e decisão

O editor Android existente já separava modelo, renderizador, histórico, Bridge Python e dois
exportadores. O editor Fabric atende desenhos legados e permanece separado. A implementação
estende esses módulos, sem React, sem CDN e sem dependências JavaScript novas em produção.
A versão 1 é migrada por cópia para v2, preservando identidades, eventos e desenhos antigos.
O validador Python é a autoridade para persistência e exportação; o schema JSON descreve a estrutura.

## Modelo e operações

`domain/model.py` resolve regras por largura: compact <600, medium <840, expanded >=840.
Landscape sobrepõe a classe de largura. As classes large/extra-large atuais ficam agrupadas
em expanded nesta versão. Overrides alteram layout, nunca duplicam conteúdo/IDs.

`static/js/model.js` concentra inserção, movimentação/reparenting/reordenação, resize,
propriedades, exclusão, agrupamento e desagrupamento. Uma movimentação é uma transação;
erros restauram o snapshot e não entram no histórico. Destinos validam ciclos, bloqueio
herdado, raízes, IDs e slots de componentes. Seleções múltiplas movem apenas ancestrais
selecionados, em ordem documental. Duplicação regenera IDs.

`drag_drop.js` usa PointerEvents com limiar de 5px, captura após ativação, ghost, destino,
marcador de inserção e snap de 8 unidades. Escape/pointercancel cancelam. A árvore e o canvas
operam sobre os mesmos comandos; o DOM não é fonte de verdade. Não há renderização integral
por movimento: só indicadores mudam até o commit. Medidas do componente definem tamanho
fixo quando um Fill é solto numa Box livre.

## Resolução e geometria

`layout.js` resolve regras e aplica Flex/Grid ao renderer. O navegador calcula medidas
intrínsecas de texto; `measure()` devolve retângulos normalizados reais para hit-testing e
diagnósticos. **Não é um solver Android independente**: métricas de fontes e widgets nativos
podem divergir. Column/Row/Grid reorganizam filhos semanticamente; Box livre usa coordenadas
relativas, ancoragem, sobreposição e ordem dos filhos. Min/max, aspect ratio, padding, margin,
weight, wrap e scroll são persistidos. Valores conflitantes são rejeitados pelo validador.

Preview possui presets, dimensões próprias, resize e rotação; não escala um desenho para
simular responsividade. Escala de fonte de 100–200% é uma simulação de acessibilidade.
Avisos medem overflow, texto truncado e alvos abaixo de 24 unidades; não são uma auditoria
completa de acessibilidade nem detector geral de sobreposição intencional versus acidental.

## Exportação

| Regra | Compose | XML |
|---|---|---|
| Auto | Column/Row/FlowRow | LinearLayout; wrap de Row gera aviso |
| Grid | Column de Rows com pesos (não lazy) | GridLayout com columnWeight |
| Livre | Box, align e offset | FrameLayout, gravity e margens |
| Min/max/aspect | widthIn/heightIn/aspectRatio | wrapper ConstraintLayout 2.2.1 |
| Classes e orientação | BoxWithConstraints com ramos resolvidos | layout-w600dp, w840dp, land e combinações |
| Visibilidade | omissão no ramo | GONE/omissão conforme resolução |

Ambos partem do IR, nunca de HTML ou um do outro. XML recusa offset não zero em ancoragem
central quando não consegue representar a regra. `agata-export-diagnostics.json` registra
avisos e `android_build_verified: false`. Overrides manuais de código continuam sob controle
do usuário e não são sobrescritos pelo gerador. Ver também ANDROID_ARCHITECTURE.md.

## Pesquisa e licenças

Inspeção de arquivos de referência; nenhum código desses motores foi copiado. SHAs abaixo
identificam blobs examinados, não versões instaladas. Integração direta foi comparada à
extensão do frontend vanilla existente.

| Fonte e implementação examinada | Licença / reutilização | Decisão para Agata |
|---|---|---|
| [Penpot](https://github.com/penpot/penpot), `common/src/app/common/geom/shapes/flex_layout.cljc`, blob `e2ed76c5cad7e51c993a9e793c90ba6ee86ea522` | MPL-2.0; alterações em arquivos cobertos devem manter disponibilização/licença | Separar bounds, áreas de drop e dados de layout; motor Clojure não incorporado |
| [dnd-kit](https://github.com/clauderic/dnd-kit), `packages/dom/src/core/sensors/pointer/PointerSensor.ts`, blob `678f1a829fe51aed00ee76171b1e310bf8d6010f` | MIT; preservar aviso em redistribuição | Base atual independente de framework e adaptadores DOM são viáveis; sensor próprio pequeno evita nova cadeia de build. Caminho React antigo não foi assumido como arquitetura atual |
| [Craft.js](https://github.com/prevwong/craft.js), `packages/core/src/editor/actions.ts`, blob `366d30b9912bac2e3f0c7deb88ce0758a6e772b6` | MIT; manter copyright/licença | Regras de aninhamento e ações atômicas; integração direta exigiria React |
| [GridStack](https://github.com/gridstack/gridstack.js), `src/gridstack-engine.ts`, blob `b93cb0cdedbbfa6620a13c0a2f47f1b92e0d11fe` | MIT; manter avisos | Packing/colisão úteis como referência; grade de dashboard não equivale a árvore Android |
| [Compose Samples](https://github.com/android/compose-samples), `Reply/app/src/main/java/com/example/reply/ui/ReplyApp.kt`, blob `921f8e3142d64a510616e7d5a225543dc7341e11` | Apache-2.0; licença/avisos e identificação de alterações se reutilizado | Classes de janela e navegação adaptativa examinadas; troca automática Bar/Rail/Drawer adiada |
| [Now in Android](https://github.com/android/nowinandroid), `app/src/main/kotlin/com/google/samples/apps/nowinandroid/ui/NiaAppState.kt`, blob `9591338f04b21afe9f0424d6054136de0688c053` | Apache-2.0 | Separação de estado/navegação como referência; não importar arquitetura de app no editor |
| [ConstraintLayout](https://github.com/androidx/constraintlayout), `constraintlayout/core/src/main/java/androidx/constraintlayout/core/widgets/ConstraintWidget.java`, blob `0cabeb5016a680da0d8551c30aa09d26ff98cead` | Apache-2.0 | Não portar solver Java; usar biblioteca Android em XML gerado |

Documentação oficial consultada: [adaptive](https://developer.android.com/develop/ui/compose/layouts/adaptive),
[constraints](https://developer.android.com/develop/ui/compose/layouts/constraints),
[basics](https://developer.android.com/develop/ui/compose/layouts/basics) e
[releases ConstraintLayout](https://developer.android.com/jetpack/androidx/releases/constraintlayout).
Ordem de modificadores e APIs dependem do pai; os exportadores não traduzem CSS literalmente.

## Evidência e reprodução

`examples/android/responsive-demo.json` contém duas Screens, título longo, campo, botão,
Card limitado, Row 1:2, Grid adaptativo e Box livre. Regeneração:
`python examples/android/create_responsive_example.py`.

- Python: 49 testes (migração, validação, qualificadores XML e parsing Kotlin incluídos).
- JavaScript: 32 testes, com transações/rollback, ciclos, locks e histórico.
- `tests/responsive_ui.cjs`: mouse real para reorder, reparent, palette, Screens, Box/resize,
  undo/redo; mede Fill/min/max, Grid, pesos, rotação, fontes e overflow; salva/reabre/exporta.
- Regressão: `ui_smoke.cjs` e `android_ui.cjs` usam templates Vela reais e serviços isolados.
  O servidor HTTP substitui a Bridge nativa apenas no teste; não valida a WebView desktop.
- Capturas: [Design](evidence/drag-responsive-design.png), [tablet](evidence/drag-responsive-tablet.png).

## Limites e próximos incrementos

- Android SDK ausente: sem assembleDebug/APK; parser Kotlin não substitui compilação.
- Mouse Chromium verificado; toque físico e WebViews Windows/Linux precisam de teste nativo.
- Snap de grade e marcador de inserção implementados; guias magnéticas entre pares,
  auto-scroll durante drag e preservação da geometria relativa de multisseleção livre pendentes
  (o drop múltiplo usa deslocamentos de 8 unidades).
- Ancoragem livre com padding/offsets complexos tem diferenças entre renderizadores.
- Painéis redimensionáveis/recolhíveis e toolbar com rolagem; menus de overflow dedicados pendentes.
- Biblioteca cresceu com Grid, Divider, Surface, ScrollContainer e IconButton; demais novos
  tipos solicitados (RadioButton, NavigationRail/Drawer, TabRow, Chip etc.) não são simulados.
- Inspector agrupa conteúdo/layout/responsividade/tipografia/aparência/eventos;
  acessibilidade e metadados de exportação ainda não possuem seções completas independentes.
- Overrides por classe não mudam tipo/orientação da árvore; reorganização estrutural adaptativa,
  navegação Bar/Rail/Drawer automática e recursos XML de dimensões extraídos ficam para outra etapa.
