# Gerenciamento, importação e listas Android

## Usar o fluxo

Na Home, **Novo projeto** mantém os templates editáveis existentes. **Próxima etapa** abre configurações Android e depois a revisão. Informe nome, namespace, pasta nova/vazia, SDKs (24–36), Compose/Views, tema e orientação; Criar registra e abre o projeto. Sem local explícito, o armazenamento gerenciado continua sendo usado. A API legada sem `settings` continua criando sketches.

**Abrir existente** registra um `project.json` sem mover seus arquivos. Recentes persistem em `project-registry.json`; projetos ausentes aparecem indisponíveis. Busca, renomeação, duplicação, configurações, abertura de pasta e remoção dos recentes operam sobre projetos reais. Remover dos recentes nunca exclui o projeto.

**Importar** aceita pasta Android/Gradle, ZIP, exportação Agata (`agata-model.json`/`project.json`) e um ou vários arquivos Kotlin. Upload de múltiplos arquivos aceita somente `.kt`. A análise cria um snapshot de preparação; a prévia contém contagens e diagnósticos reais. Cancelar elimina a preparação. Confirmar copia os fontes para o projeto gerenciado, sem editar a entrada. Uma pasta vazia exige a ação explícita de inicialização naquele destino.

O Project Explorer distingue Screens/Components/Navigation virtuais de Resources/Source Files no snapshot. Abrir uma fonte usa CodeMirror; salvar cria `source-edits`, com verificação de versão SHA-256 e backup da cópia anterior. **Reanalisar fontes Kotlin** apresenta uma prévia e aplica a árvore em uma transação de undo. O IR anterior também é arquivado ao salvar um projeto importado. Reanálise não resolve dependências nem executa Kotlin.

Projetos Gradle sem UI abrem com zero Screens, botões para criar a primeira Screen, escolher template e abrir configurações. `Scaffold {}` vira um container editável. Kotlin sem UI fica acessível no explorer, sem inventar uma tela de aplicação.

## Compatibilidade do parser

Tree-sitter Kotlin analisa a sintaxe; regex é usada somente para valores escalares/metadados Gradle, nunca para estruturas aninhadas. IDs derivam de caminho, função e posição estrutural da chamada; edições estruturais anteriores a um nó podem mudar sua identidade durante reanálise.

| Recurso | Reconstrução visual |
|---|---|
| Exportação nativa Agata | IR versionado recupera IDs, Screens, eventos, layouts responsivos, camadas e recursos sem engenharia reversa do Kotlin |
| Column, Row, Box, Spacer | Hierarquia estática e filhos |
| BoxWithConstraints, Scaffold, wrappers `*Theme` | Conteúdo estático parcial; regras/tema externos preservados no fonte |
| Text, Button/TextButton/OutlinedButton, IconButton, Card, Surface | Valores literais, conteúdo estático e variantes |
| TopAppBar, NavigationBar, NavigationBarItem | Estrutura e slots reconhecidos; revisão necessária de parâmetros externos |
| TextField/OutlinedTextField, Checkbox, Switch, Slider | Valores reconhecidos; estados/callbacks dinâmicos preservados no fonte |
| Image, Icon, painterResource | PNG local; ícones `agata_*` conhecidos. Drawables vetoriais arbitrários permanecem no snapshot |
| stringResource, R.string, R.color, Color, RoundedCornerShape | Recursos base values e literais; variantes/localização/expressões externas não avaliadas |
| width, height, size, padding, fillMax*, weight, background | Subconjunto literal; offset parcial. Border, alpha, zIndex e modifiers desconhecidos geram avisos |
| ConstraintLayout | createRef, constrainAs, linkTo pai/irmão, margem literal, Dimension.fillToConstraints/wrapContent, guidelines percentuais e biases literais |
| Navigation | Chamadas AST `onAction("navigate"/"replace"/"back", literal)` e `navigate(literal)`; destino por ID/função conhecida; ausentes marcados como quebrados |
| LazyColumn, LazyRow, LazyVerticalGrid, LazyVerticalStaggeredGrid | `item {}` estático; colunas GridCells.Fixed. `items(data)` dinâmico permanece Code Only |
| Composables personalizados, loops, estados, ViewModels, effects | Preservados no fonte com diagnósticos; não há interpretação/execução |

Classificações Fully Editable, Partially Editable e Code Only são calculadas sobre chamadas analisadas; não são garantia de equivalência comportamental de um arquivo arbitrário. Composables reutilizáveis podem aparecer como Screens separadas; não há resolução geral de grafo de chamadas/rotas NavHost. ConstraintSets externos, chains recíprocas, ciclos e layouts XML tradicionais não são reconstruídos; recursos XML são distintos de layouts XML.

## Listas editáveis e exportação

Cada filho de uma lista é um item visual editável e recebe ID próprio. Use altura finita, gap e columns; RecyclerView também possui `orientation` (`vertical`/`horizontal`) e `layoutManager` (`linear`/`grid`/`staggered`). Preview mostra os itens e rolagem; renderiza todos os itens finitos do IR, sem virtualização de DOM nem conexão automática com API/banco.

| Componente da paleta | Compose | Views/XML |
|---|---|---|
| ListView | LazyColumn | ListView + BaseAdapter |
| RecyclerView | LazyColumn/LazyRow ou grid conforme propriedades | RecyclerView + Adapter e layout manager correspondente |
| GridView | LazyVerticalGrid | GridView + BaseAdapter |
| LazyColumn | LazyColumn | RecyclerView + LinearLayoutManager vertical |
| LazyRow | LazyRow | RecyclerView + LinearLayoutManager horizontal |
| LazyVerticalGrid | LazyVerticalGrid | RecyclerView + GridLayoutManager |
| LazyStaggeredGrid | LazyVerticalStaggeredGrid | RecyclerView + StaggeredGridLayoutManager |

`LazyStaggeredGrid` é o nome na paleta; o nome real da API Compose emitida é `LazyVerticalStaggeredGrid`. O exportador emite `item(key = ID)` por filho, layouts XML de item e adapters Kotlin reais. Fontes de dados arbitrárias, paging, diffing, seleção persistente e binding de ViewModels não são sintetizados.

## Exportação e preservação

Em importações nativas com Gradle, arquivos reconhecidos como geração original podem ser regenerados. Arquivos alterados/customizados são mantidos e a alternativa vai para `agata-generated-conflicts`. A entrada completa sempre permanece em `agata-original`; cópias editadas também são incluídas em `agata-source-edits`. Mudar de backend ou importar somente Kotlin produz projeto gerado separado, com cópia dos originais.

Em projetos Android externos, Gradle e MainActivity originais são preservados. A interface é gerada como `AgataImportedActivity`; o launcher não muda por padrão. **Exportar cópia com Activity inicial Agata** salva o modelo e altera somente o manifesto da cópia exportada, adicionando dependências ao módulo quando encontrado. Plugins, versões Gradle, catálogos, flavors e namespace existentes não são reescritos automaticamente. Projetos Compose ainda precisam de configuração Compose compatível; conflitos de recursos devem ser revisados. Exportar fonte não comprova compilação.

Limites: 2.000 arquivos, 100 MB descomprimidos, 8 MB/arquivo, upload ZIP 30 MB, razão máxima de compressão 1.000. Traversal, caminhos absolutos, duplicatas de nome, ZIP corrompido, links simbólicos e arquivos especiais são rejeitados. Pastas de build/cache são ignoradas. Não há execução de Gradle, scripts, Kotlin nem resolução remota durante análise/preview.

## Referências consultadas

- [Documentação oficial de listas Compose](https://developer.android.com/develop/ui/compose/lists)
- [RecyclerView e layout managers](https://developer.android.com/develop/ui/views/layout/recyclerview)
- [Exemplos abertos de staggered grids AndroidX](https://android.googlesource.com/platform/frameworks/support/+/4c3178d8a79df359648d82807f3b00e568f063b5/compose/foundation/foundation/samples/src/main/java/androidx/compose/foundation/samples/LazyStaggeredGridSamples.kt)
