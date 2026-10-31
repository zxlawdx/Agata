# Constraints, regiões, Layers e tutorial — IR v3

## Auditoria e fronteiras preservadas

Base: main após PR #8. O IR v2, comandos transacionais, Flex/Grid do Preview e exportadores
independentes já funcionavam. A extensão mantém Fabric/Desenho, projetos vazios, histórico,
Bridge, custom source e layouts automáticos. A migração v1 → v2 → v3 é aditiva por cópia:
IDs/eventos permanecem; novas constraints começam vazias e camadas começam sem associações.
Não há migração de desenhos Fabric para constraints Android.

## Domínio, resolvedor e interação

`domain/constraints.py` valida alvos pai/irmãos, eixos, baseline, margens, bias e ciclos.
Links estão em `layout.constraints[âncora] = {target, anchor, margin}`; o nó proprietário
identifica a origem. Todos os links são obrigatórios; não existem prioridades opcionais.
`horizontalBias` e `verticalBias` pertencem ao nó. Helpers são nós Guideline/Barrier,
com percent/orientation e direction/references/barrierMargin respectivamente.

`constraints.js` recebe árvore, espaço, direção RTL e medidas intrínsecas, e devolve
retângulos/diagnósticos sem consultar DOM no método `solve`. Usa ordenação de dependências
e eliminação gaussiana com pivotamento em quatro variáveis por widget (x, largura, y, altura).
Dois links opostos + tamanho conhecido formam a equação de bias; Fill respeita o intervalo e
min/max. Guidelines são posições percentuais; barriers são extremos dos alvos resolvidos.
Isso é um subconjunto dirigido e acíclico, **não um port do solver Android nem um solver
geral com prioridades**. Chains e ciclos mesmo entre eixos distintos são rejeitados.

O adaptador `layout` mede conteúdo do navegador e aplica os retângulos. Baseline usa aproximação
de 0,8 × tamanho de fonte; métricas reais do Android podem divergir. Há avisos para eixo livre
(subdeterminado, usando x/y) e intervalo menor que tamanho mínimo/fixo. Não há classificação
completa de todo sistema linear contraditório: só os casos suportados recebem garantia.

`constraint_editor.js` desenha âncoras e links cianos no pai selecionado. Alças de resize são
quadradas. As setas roxas entre Screens continuam representando navegação. Arrastar conecta,
Ctrl/Cmd+clique ou linha remove; Inspector oferece edição via teclado. Um link só entra no
histórico após validação; tentativa inválida restaura o snapshot. Linhas/alças não entram no
Preview nem no código. Soltar em ConstraintLayout oferece escolhas explícitas de posicionamento;
links existentes são preservados até uma escolha. O arraste não cria relações inferidas silenciosamente.

## Regiões e camadas

Region é um contêiner genérico horizontal/vertical. Pode ser filho de Auto Layout, Box ou
ConstraintLayout, com dimensões, padding, regras responsivas e filhos independentes.
O template tem duas laterais simultâneas. Os componentes Material existentes mantêm seus
contratos: Sidebar Material ainda exige posição suportada e não deve ser confundida com
Region genérica. Não há conversão automática Sidebar → Drawer compacta.

`screen.layers` referencia nós: id, name, nodes, visible, locked e opacity. A ordem da lista
controla z local entre irmãos. Não muda a ordem semântica/leitura nem cria um segundo parentesco.
Uma associação por nó é permitida; associar um novo layer remove a associação anterior desse nó.
Ocultar, bloquear e opacidade afetam a subárvore. Duplicação regenera IDs e relações internas;
reparenting limpa links que deixam de ser locais. Excluir alvos de Barrier exige remover o
helper junto ou definir referências restantes. Ordens de camadas em pais diferentes não formam
um z global. O lock herdado é uma regra de edição, não uma propriedade de execução Android.

## Exportadores

| IR | XML | Compose |
|---|---|---|
| Layout de restrições | ConstraintLayout 2.2.2 | constraintlayout-compose 1.1.2 |
| Relações | atributos layout_constraint* | referências, constrainAs, linkTo |
| Helpers | Guideline/Barrier com IDs estáveis | createGuidelineFrom*/create*Barrier |
| Fill entre lados | 0dp e limites | Dimension.fillToConstraints e atLeast/atMost |
| Livre subdeterminado | margem e link explícito ao pai, aviso | linkTo(parent) e margem, aviso |
| Camadas | alpha/translationZ | graphicsLayer/zIndex |
| Region | LinearLayout | Row/Column |

Versões verificadas na documentação oficial. Helpers não viram linhas visíveis. Eventos e IDs
são preservados. Classes de largura usam os qualificadores/ramos existentes. GONE/visibilidade,
fontes e elevação Material podem divergir do Preview em casos de referências a componentes
ocultos; confira a execução nativa. Aspect ratio combina melhor com uma dimensão Fill; casos
com ambos os tamanhos fixos não são um motor geral de negociação de constraints.

**SDK ausente:** assembleDebug, APK, emulador, IME/insets XML e WebViews Windows/Linux ainda
não verificados. Parsing Kotlin e XML são evidência sintática/estrutural, não compilação.
Compose mantém safeDrawingPadding já existente; o Preview não emula o teclado/sistema Android.

## Tutorial reutilizável

`domain/tutorial_project.py` fornece um modelo real de três Screens; ProjectService seleciona
o template apenas quando solicitado. A home mantém Projeto vazio. `tutorial.js` define 15
etapas com id, título, descrição, target estável, posição preferida, ação e próximo índice.
Critérios são contagens do modelo ou eventos de operações/exportação concluídas, nunca timers
que fingem uma ação. Próximo só libera após prática; Pular esta prática é explícito.

O destaque não bloqueia o workspace; caixa com role=dialog/aria-modal=false permite aprender
operando a UI. O tour abre painéis, rola ao alvo, mostra fallback se estiver ausente, aceita
Escape/Alt+setas, oferece Voltar/Pular/Concluir e retoma por Ajuda. Progresso por projeto e
preferência global de não mostrar novamente usam localStorage do perfil; não viajam no ZIP.
Posição preferida está nas definições, mas a caixa usa canto inferior direito fixo nesta versão;
posicionamento automático em torno do alvo e auditoria completa de leitor de tela ficam pendentes.
Não se incorporou uma dependência de onboarding.

## Investigação técnica e licenças

Arquivos efetivamente lidos; nenhum código desses projetos foi transplantado. A análise distingue
conceitos aproveitáveis de integração binária ou de frontend. Não se presumiu que todo editor
Android Studio esteja disponível no intellij-community.

| Projeto e módulo | Problema/decisão | Licença e integração |
|---|---|---|
| [AndroidX ConstraintLayout](https://github.com/androidx/constraintlayout), `core/.../widgets/Guideline.java`, `Barrier.java`, `Chain.java`; `compose/.../ConstraintLayout.kt`, `ConstraintLayoutBaseScope.kt`, `ConstrainScope.kt`, `ConstraintScopeCommon.kt` (sob constraintlayout/) | Percentuais, extremos, equações de bias, helper refs e DSL examinados. Chains exigem sistema mais geral; rejeitadas por enquanto. APIs nativas são usadas na exportação | Apache-2.0; sem cópia do solver Java. Dependências Android preservam sua distribuição normal |
| [ConstraintLayout Examples](https://github.com/android/views-widgets-samples/tree/main/ConstraintLayoutExamples), `constraintlayout/src/main/res/layout/constraint_example_4.xml` e README | Repositório indicado pela documentação: googlearchive/android-ConstraintLayoutExamples aponta para views-widgets-samples; inspecionados exemplos de XML nativo | Apache-2.0 nos arquivos; referência, não runtime |
| [IntelliJ Community](https://github.com/JetBrains/intellij-community), `plugins/ui-designer-core/src/com/intellij/designer/DesignerToolWindow.java` | ComponentTree/PropertyTablePanel/Splitter mostram separação árvore/inspector. É infraestrutura Swing de designer; não prova presença do Layout Editor Android completo | Apache-2.0 no arquivo; Java/Swing não integrado ao frontend vanilla |
| [Penpot](https://github.com/penpot/penpot), `common/src/app/common/geom/shapes/flex_layout.cljc` e `flex_layout/drop_area.cljc` | Facade separa bounds/layout/drop; índices de inserção dependem da orientação. Manter comandos/solver/renderer separados | MPL-2.0; integração direta Clojure desnecessária; alterações em arquivos cobertos exigiriam condições MPL |
| [Craft.js](https://github.com/prevwong/craft.js), `packages/core/src/editor/actions.ts` | Reparenting e validação do destino antes de mutação; ações transacionais próprias mantidas | MIT (LICENSE lido); React não introduzido |
| [GridStack](https://github.com/gridstack/gridstack.js), `src/gridstack-engine.ts` | Resize/move e engine independente são úteis; packing de dashboard não equivale a anchors Android | MIT (LICENSE lido); não integrado |
| [Compose Samples](https://github.com/android/compose-samples), `Reply/.../ui/ReplyApp.kt` | Navegação/layout adaptativo real exige escolha explícita de contêiner, não apenas escala | Apache-2.0; exemplos como referência, conversão automática de navegação adiada |
| [Now in Android](https://github.com/android/nowinandroid), `app/src/main/kotlin/.../ui/NiaAppState.kt` | Estado de navegação separado de apresentação; manter IR e histórico fora do renderizador | Apache-2.0; não importar arquitetura inteira do app |
| [Driver.js](https://github.com/nilbuild/driver.js), `packages/driver/src/driver.ts` e `license` | O URL kamranahmedse redireciona; API highlight/drive/destruição é viável em vanilla. Sistema próprio é suficiente para critérios vinculados ao IR | MIT; se incorporado, preservar licença/copyright. Nenhum bundle incluído |
| [Shepherd](https://github.com/shipshapecode/shepherd), `shepherd.js/src/step.ts` e LICENSE.md | Modelo de etapas/eventos e limpeza útil; integração direta dispensada | Licença atual declara AGPL-3.0/comercial; não presumir MIT nem incorporar sem atender condições |
| [Intro.js](https://github.com/usablica/intro.js), `src/packages/tour/tour.ts` e license.md | next/previous e callbacks examinados; não necessário para o tour pequeno | license.md declara condições AGPL/comerciais; não incorporado |

Fontes oficiais: [editor e constraints](https://developer.android.com/develop/ui/views/layout/constraint-layout),
[Compose ConstraintLayout](https://developer.android.com/develop/ui/compose/layouts/constraintlayout),
[releases](https://developer.android.com/jetpack/androidx/releases/constraintlayout).
A documentação atual recomenda outros layouts Compose quando adequados e informa manutenção
da biblioteca ConstraintLayout; sua inclusão aqui atende à semântica explícita solicitada,
sem substituir Column/Row/Grid funcionais.

## Evidências e reprodução

- `python -m unittest discover -s tests -v`: inclui template/exportadores, migração, rejeições,
  camadas e parsing de Kotlin gerado.
- `node --test tests/*.test.cjs`: inclui solver puro em 320–1200, bias, RTL, helpers, conflitos,
  rollback, clone de referências e lock de camada.
- `npm run test:constraints-ui`: home → template, prática/retomada/reinício/pulo/conclusão,
  arraste real de alça, eixo inválido, bias, filho na barra, camadas, Preview 320/480/768,
  navegação, save/reopen e dois ZIPs.
- Regressões Fabric, Android e drag/responsividade permanecem no CI.
- Modelo reproduzível: `python examples/android/create_tutorial_example.py`.
- [Captura real](evidence/constraints-tutorial.png).

Pendentes, sem controles fictícios: chains, prioridades flexíveis/soft constraints, baseline de
métrica nativa no Preview, guidelines em dp além de percentuais, auto Drawer, roteamento visual
avançado das linhas, z global entre pais, tour posicionado por colisão e validação Android nativa.
