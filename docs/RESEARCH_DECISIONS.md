# Pesquisa e decisões — implementação do prompt mestre

Os módulos abaixo foram examinados nas auditorias desta série. As referências anteriores
continuam detalhadas em DRAG_DROP_RESPONSIVE_ARCHITECTURE.md e CONSTRAINTS_REGIONS_TUTORIAL_ARCHITECTURE.md.
Esta etapa acrescenta inspeção de navegação, gráficos e manutenção atual. Nenhum código de
motor externo foi copiado; não há novas dependências JavaScript de produção.

| Fonte/módulo | Problema, compatibilidade e decisão | Licença/manutenção/risco |
|---|---|---|
| AndroidX ConstraintLayout `core/.../widgets/{Guideline,Barrier,Chain}.java`, `compose/.../{ConstraintLayout,ConstrainScope,ConstraintLayoutBaseScope}.kt` | IR próprio acíclico; biblioteca oficial no código Android. Corrigir overlay não exigia portar solver | Apache-2.0; biblioteca em manutenção segundo documentação oficial; chains/prioridades seguem fora do subconjunto |
| Penpot `common/src/app/common/geom/shapes/flex_layout/drop_area.cljc` | Separar bounds, índices e modifiers; não integrar Clojure ao frontend vanilla | MPL-2.0; respeitar condições por arquivo se reutilizado; sem cópia |
| dnd-kit `packages/dom/src/core/sensors/pointer/PointerSensor.ts` | Fonte atual independente de framework confirma sensores/activation/cancel; manter sensor próprio pequeno | MIT; não presumir arquitetura React antiga; novo bundle não necessário |
| Craft.js `packages/core/src/editor/actions.ts` | Reparenting validado antes do commit; comandos do Agata preservados | MIT; dependência React não introduzida |
| GridStack `src/gridstack-engine.ts` | Packing/resize de dashboard não substitui árvore Android; integração rejeitada | MIT; diferenças de semântica e colisões |
| Compose Samples `Reply/.../ReplyApp.kt` | Layout adaptativo e estado de navegação separados; não converter Sidebar em Drawer silenciosamente | Apache-2.0; referência de app, não infraestrutura do editor |
| Now in Android `app/.../ui/NiaAppState.kt` | Estado independente do renderizador | Apache-2.0; não transplantar arquitetura inteira |
| Architecture Samples `app/src/main/java/com/example/android/architecture/blueprints/todoapp/TodoNavGraph.kt` | Handlers de navegação e rotas estáveis; gerar políticas explícitas e código auxiliar Views | Apache-2.0; parâmetros/rotas tipadas avançadas não são inferidos |
| MPAndroidChart `MPChartLib/src/main/kotlin/com/github/mikephil/charting/renderer/LineChartRenderer.kt` | Código atual é Kotlin; caminho Java antigo retornou ausente. Examina Canvas/Paint/paths e buffers. Não incorporar biblioteca para subconjunto pequeno | Apache-2.0 (LICENSE lido); evitar presumir que 3.1.0 ainda é a estrutura atual; API/manutenção/dependências precisam avaliação ao integrar versão específica |
| Vico `vico/compose/src/commonMain/kotlin/com/patrykandpatrick/vico/compose/cartesian/CartesianChartHost.kt` | Modelo/produtor separado, viewport, scroll e estado vazio. Projeto atual multiplataforma; caminho src/main antigo não existe | Apache-2.0 (LICENSE lido); integração direta amplia cadeia Kotlin/Compose. Nenhuma versão instalada; gerador próprio Canvas atende o subconjunto atual |
| Driver.js `packages/driver/src/driver.ts` (repositório redirecionado a nilbuild) | Tour vanilla viável, mas critérios de prática já integrados ao IR | MIT; manter aviso se incorporado; não adicionado |
| Shepherd `shepherd.js/src/step.ts`, LICENSE.md | Etapas/callbacks úteis como referência; sistema próprio existente suficiente | Licença atual AGPL/comercial; não assumir MIT |
| Intro.js `src/packages/tour/tour.ts`, license.md | next/previous e callbacks; não integrado | Condições AGPL/comerciais devem ser atendidas se usado |
| IntelliJ `plugins/ui-designer-core/src/com/intellij/designer/DesignerToolWindow.java` | ComponentTree + PropertyTablePanel + Splitter; não é prova de todo editor Android Studio aberto neste repositório | Apache-2.0 no arquivo; Swing não integrado |

Documentação oficial consultada:
- https://developer.android.com/develop/ui/views/layout/constraint-layout
- https://developer.android.com/develop/ui/compose/layouts/adaptive
- https://developer.android.com/develop/ui/compose/navigation
- https://developer.android.com/guide/navigation/backstack
- https://developer.android.com/develop/ui/compose/graphics/draw/overview
- https://developer.android.com/reference/kotlin/androidx/compose/ui/graphics/drawscope/DrawScope

Compose Canvas/DrawScope e VectorDrawable foram comparados a uma View Canvas/Paint. A escolha
atual gera classes vetoriais nativas e usa AndroidView no Compose: um caminho de renderização
Android para ambos os backends, incluindo textos que VectorDrawable não descreve. Preview é SVG
estruturado próprio. Não há screenshots de gráficos ou promessas de importar SVG arbitrário.
O desenho é escalado dentro do componente DrawingCanvas; isso é distinto da responsividade
estrutural da Screen, que continua resolvendo regras e dimensões.
