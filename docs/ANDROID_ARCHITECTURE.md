# Arquitetura Android do Agata

## Fonte de verdade e limites da migração

O projeto JSON existente continua como agregador. `interface_document.version=1` é o IR
semântico; `interface_revision` é a versão otimista de escrita. A árvore é independente de
Fabric/HTML e contém tipos, IDs, papéis, conteúdo, estilo, layout, filhos, estado e eventos.
Screen contém posição de workspace e árvore; o projeto fornece tema, namespace, arquivos
customizados e Screen inicial. O IR é armazenado separadamente de `screens`/camadas legadas.

`static/model/components.json` é o registro compartilhado entre Python e JavaScript.
`schema.json` descreve a estrutura; `domain/model.py:validate` impõe também invariantes entre
nós: unicidade, limites de profundidade/tamanho, destino de navegação existente, namespace,
cores, tipos, pesos válidos e caminhos de arquivos customizados. Versões futuras são rejeitadas.
`services/migrations.py` cria um documento novo aditivamente para projetos sem IR; não perde
nem converte desenhos existentes. Não existe uma suposta migração de uma versão IR anterior
que nunca foi distribuída.

## Módulos

| Módulo | Responsabilidade |
|---|---|
| domain/model.py | Registro, fábrica, validação e percurso da árvore. |
| services/documents.py | Consulta, escrita atômica via repositório existente e revisão otimista. |
| services/migrations.py | Fronteira explícita entre projeto gráfico antigo e novo modelo. |
| static/js/model.js | Comandos, snapshots undo/redo, novos IDs e limpeza de conexões. |
| static/js/renderer.js | Renderizador DOM do IR em edição e Preview, sem executar fonte customizada. |
| static/js/designer.js | Coordenação de workspace, árvore, Inspector, navegação, código e Bridge. |
| exporters/compose.py | Mapeamento Compose, strings, vetores originais e estado. |
| exporters/xml.py | Mapeamento XML nativo/Material e Activity de navegação. Não deriva do código Compose. |
| exporters/project.py | Configuração Android, dependências, wrapper, overrides e ZIP. |
| static/vendor | Bundle CodeMirror e licenças locais. Não há CDN ou build frontend na execução. |

O exportador XML reutiliza os utilitários de recursos/escape do gerador base, não sua saída
Kotlin/Compose. Desenhos Fabric nunca são usados como entrada para o gerador Android.
Posições das Screens são usadas apenas no workspace e no JSON, não viram offsets Android.
Row/Column/Box expressam relações internas; pesos só são aceitos em Row/Column sem scroll.

## Código e proteção de edições

- Design → IR → fonte gerada, sem parse reverso arbitrário de Kotlin.
- JSON do IR → validação → Design é o subconjunto bidirecional formalmente suportado.
- Personalizar um arquivo cria override explícito em `custom_files[backend/path]`.
- Overrides Compose e XML são separados, inclusive quando ambos têm `MainActivity.kt`.
- Geração/exportação respeita esses arquivos; não faz merge nem os sobrescreve silenciosamente.
- Rascunhos JSON são mantidos enquanto a página estiver montada. Se o Design mudar depois do
  início do rascunho, aplicar é bloqueado com diagnóstico; o usuário pode copiar seu JSON e
  descartar o rascunho explicitamente. Rascunhos ainda não aplicados não são persistidos como IR.
- CodeMirror oferece cores Kotlin/XML/JSON, numeração, indentação, histórico textual e
  pesquisa/substituição (Ctrl/Cmd+F). Formatação explícita disponível para JSON.
- Não há LSP, resolução semântica Kotlin, compilador Android integrado ou Kotlin→Design.

## Matriz inicial por backend

| Tipo / recurso | Preview web | Compose | XML |
|---|---|---|---|
| TextLabel | Editável, multilinha | Text + stringResource | TextView |
| Button / filhos | Texto/ícone separados, enabled e evento | Button/Outlined/Text/Tonal | MaterialButton com texto/ícone projetados; evento no botão, não nos filhos |
| Card | Contêiner de filhos editáveis | Card/Elevated/Outlined | MaterialCardView + LinearLayout interno |
| TopBar | Título, ícone e ações como filhos | TopAppBar e slots | LinearLayout horizontal (sem AppBarLayout nesta etapa) |
| Sidebar | Painel com itens editáveis | ModalNavigationDrawer no nível principal, menu de abertura gerado | LinearLayout vertical, sem DrawerLayout completo |
| BottomBar | Itens com texto/ícone/ação | NavigationBar / NavigationBarItem | LinearLayout horizontal com MaterialButton por item |
| TextField | Valor local, label/placeholder/helper/error e ícones | TextField/OutlinedTextField + rememberSaveable | TextInputLayout/TextInputEditText; helper/error/keyboard |
| SearchBar | Digitar/limpar | OutlinedTextField como alternativa estável | SearchView nativo; ícones nativos não substituídos pelos filhos customizados |
| Checkbox/Switch/Slider | Estado local | Componentes Material + rememberSaveable | Widgets nativos (Slider normalizado 0–100) |
| Image | PNG local embutido | Image + recurso drawable | ImageView + drawable |
| FloatingButton | Ação inicial | FloatingActionButton | Material FAB |
| Row/Column/Box/Spacer | Flex/Grid | Row/Column/Box/Spacer | LinearLayout/FrameLayout/Space |
| Navegação | onClick navigate/back e pilha | Navigation Compose | Activity Kotlin + histórico de rotas |
| Tema | Representação visual parcial | Primária, light/dark/system, dynamic color | Tema Material3 DayNight padrão e colors.xml |

Componentes adicionais, fidelidade de sombras/estados/tipografia, eventos de formulário e
navegação adaptativa permanecem incrementais. O renderer web não é um emulador Android.
As capacidades registradas não significam que cada combinação tenha sido validada no runtime
Android. Entradas não representáveis, como Image sem PNG e eventos em filhos de Button no XML,
geram erros explícitos em vez de arquivos com referências ausentes.

## Versões verificadas e escolhidas

Foram selecionadas versões estáveis fixas, não dependências dinâmicas nem uma alegação de
“todas as versões mais recentes”. A tabela oficial de compatibilidade e o POM do BOM escolhido
foram consultados durante a implementação (31/10/2026).

| Peça | Versão | Observação |
|---|---|---|
| AGP | 8.13.2 | [Notas oficiais](https://developer.android.com/build/releases/agp-8-13-0-release-notes): Gradle 8.13, JDK 17, API 36 suportada. |
| Gradle Wrapper | 8.13 | JAR/scripts oficiais, SHA-256 do wrapper e da distribuição fixados. Apache-2.0. |
| Kotlin / plugin Compose | 2.2.20 | Mesma versão para os dois plugins, conforme [modelo Kotlin 2+](https://developer.android.com/develop/ui/compose/bom). |
| Compile/Target SDK | 36 | Min SDK 24. SDK não instalado neste ambiente de trabalho. |
| Compose BOM | 2025.10.01 | [POM oficial verificado](https://dl.google.com/dl/android/maven2/androidx/compose/compose-bom/2025.10.01/compose-bom-2025.10.01.pom); dependências Compose seguem o BOM. |
| Navigation Compose | 2.9.5 | [Release oficial](https://developer.android.com/jetpack/androidx/releases/navigation), NavHost/rememberNavController/composable. |
| Activity Compose / Core KTX | 1.11.0 / 1.17.0 | Dependências declaradas explicitamente. |
| Material Views / AppCompat | 1.13.0 / 1.7.1 | Declaradas apenas no projeto XML. |
| CodeMirror | Pacotes 6.x fixados no lockfile | Versões exatas, licenças e SHA do bundle em `static/vendor/NOTICE.json`. |

TopAppBar é utilizado com `@OptIn(ExperimentalMaterial3Api::class)` explícito, porque a API da
versão Material escolhida pode exigir anotação mesmo em biblioteca estável. Busca usa
OutlinedTextField, evitando introduzir o estado/API experimental SearchBar.

## Pesquisa de projetos e licenças

Os snapshots de HEAD e dos blobs consultados estão em `docs/android-research.json`. São
registros de referência, não dependências instaladas no Agata. Nenhum framework completo
foi copiado destes projetos.

| Projeto / fonte inspecionada | Licença conferida | Decisão aplicada |
|---|---|---|
| [Now in Android — NiaApp.kt](https://github.com/android/nowinandroid) | Apache-2.0 no arquivo | Separar estado/navegação da apresentação e tema. Sem copiar os módulos do aplicativo. |
| [Compose Samples — JetsnackApp.kt](https://github.com/android/compose-samples) | Apache-2.0 no arquivo | NavHost e callbacks; não adotar as animações experimentais do exemplo. |
| [AndroidX — material3/Button.kt](https://github.com/androidx/androidx) | Apache-2.0 no arquivo | APIs públicas das variantes, conteúdo em slots, não copiar implementações internas. |
| [Material Android — MaterialButton.java](https://github.com/material-components/material-components-android) | Apache-2.0 no arquivo | Declarar Material Views e projetar texto/ícone no componente nativo. |
| [Material Web — button/filled-button.ts](https://github.com/material-components/material-web) | Apache-2.0 no arquivo | Separação de variantes e semântica. Não incluir Lit/Material Web no runtime. |
| [Material Design Icons — LICENSE](https://github.com/google/material-design-icons) | Apache-2.0 | Avaliada a atribuição; optou-se por vetores originais simples, não importar catálogo de ícones. |
| [Monaco — README e LICENSE.txt](https://github.com/microsoft/monaco-editor) | MIT | Avaliado suporte/empacotamento ESM e workers; não escolhido para este primeiro editor offline. |
| [CodeMirror dev e view LICENSE](https://github.com/codemirror/dev) | MIT | Escolhido por composição modular Kotlin stream mode + XML/JSON e busca, bundle local sem workers/LSP. O README informa mudança do repositório principal. |
| [Penpot — workspace/shapes.cljs](https://github.com/penpot/penpot) | MPL-2.0 no arquivo | Conceitos de árvore, IDs e histórico; nenhum código Clojure importado. |
| [Excalidraw — packages/element/src/binding.ts e LICENSE](https://github.com/excalidraw/excalidraw) | MIT | Conexão semântica e separação de geometria/estado; implementação própria reduzida. |

A escolha CodeMirror foi de escopo/integração, não resultado de benchmark quantitativo entre os
editores. O bundle efetivamente incorporado tem 383.077 bytes nesta revisão. Fontes do adaptador,
lockfile e build estão em `scripts/code-editor/`; as 18 licenças transitivas ficam junto do bundle.
O Gradle Wrapper mantém sua licença e comentários originais; checksums e origem estão em
`resources/gradle/metadata.json` e seguem para os projetos exportados.

## Verificação

Sintaxe Kotlin/KTS: parser tree-sitter; XML: ElementTree e referências a recursos/IDs.
Geração: goldens reproduzíveis em `examples/android/`, escapes, namespace, navegação,
independência de posição de frames, arquivos customizados e ZIP real testados.
Somente `./gradlew assembleDebug` com SDK pode confirmar compilação Android. Isso não foi
executado, portanto nenhum APK nem promessa de build aprovado fazem parte desta entrega.
