# Importação Compose: correção estrutural e evidências

## Caso real recebido

O ZIP `agata_spotify_ui(1).zip` contém **somente três arquivos Kotlin**, sem Activity, Gradle, manifesto, IR Agata, fontes ou recursos Android. As cópias em `examples/spotify_import` são os três arquivos recebidos, sem alterações. Não há um projeto Android compilável completo no ZIP.

A análise anterior promovia as sete funções @Composable a Screens e não resolvia os tokens do objeto AgataDark. A nova análise gera:

- Home: `s_c311e2496dd94522a1e5322a30bbb754`.
- Login: `s_0bc68d799c0948d7b79c32de362ebcb5`.
- Dashboard: `s_ca504b5fa758496588365d681e68ea80`.
- Definições reutilizáveis: AgataHero, AgataPanel, AgataAction e MetricCard. Cada definição é registrada uma vez; instâncias mantêm referência, argumentos e uma projeção editável dos seus filhos. Editar uma projeção não altera automaticamente as demais.

Os nomes Home/Login/Dashboard e a inicial Home vêm dos IDs associados às constantes AGATA_HOME/LOGIN/DASHBOARD. Para outros projetos, destinos composable/dialog, setContent e grafo de chamadas têm precedência. Raízes ambíguas aparecem com classificação revisável na prévia; não se usa uma lista de nomes como detector geral de Screens.

## Arquitetura

O IR v4 e o editor existentes foram mantidos. Campos opcionais `compose_project` e `node.compose` guardam definições, símbolos, temas, fontes, candidatos de Screen, origem por propriedade, argumentos de instância, cadeia de Modifiers ordenada, estados de resolução e expressões não reconstruídas. Projetos legados continuam usando seus renderers e geradores existentes; a extensão é validada separadamente.

Responsabilidades:

- `compose_index.py`: unidades Kotlin, imports/aliases, constantes/objetos, funções, parâmetros, chamadas e evidências de entradas.
- `compose_values.py`: resolução estática limitada de literais, símbolos, recursos, MaterialTheme, Typography, shapes e contextos light/dark; nenhum eval ou Kotlin executado.
- `compose_modifiers.py`: percorre somente o receiver da cadeia em ordem, sem duplicar prefixos. Registra categoria, valores, expressão e intervalos UTF-8.
- `compose_fidelity.py`: mapeia contexto, instâncias, estilos, callbacks e ramos responsivos ao mesmo modelo semântico.
- `compose_presentation.js`: aplica estilos e wrappers de medição/desenho ordenados ao mesmo renderer de Design/Preview. Os wrappers não criam componentes editáveis independentes.
- `source_patch.py`: aplica patches escalares apenas quando arquivo/hash/expressão/intervalo ainda coincidem. Argumentos explícitos de instância podem ser editados se houver um único uso correspondente; definição compartilhada permanece intacta.
- `exporters/compose_fidelity.py`: preserva a sequência suportada ao emitir Kotlin, incluindo gradientes, limites de tamanho e scroll.

O índice não é PSI nem um compilador Kotlin. Funções sobrecarregadas/receivers complexos, dependências externas, geração de código e resolução completa de source sets Gradle não são interpretados. Arquivos são descobertos pelo scanner, sem executar configurações Gradle. Ambiguidades e expressões sem contexto devem continuar em fonte e diagnóstico.

## Estilos e layout efetivamente corrigidos

No projeto recebido:

- AgataDark.background `#101114`, surface `#191B1F`, surfaceRaised `#24272C`, accent `#1ED760`, text `#F5F7F7` e secondary `#B0B5B9` são resolvidos entre os arquivos.
- Textos/cores e Modifiers passados aos helpers são aplicados por instância; callbacks onAction com constantes recuperam navegação.
- Gradiente do Hero, shapes arredondados, fontSize/Weight/lineHeight, padding, gap, fill, width/heightIn, weight e scroll são reconstruídos no subconjunto suportado.
- `wide = maxWidth >= 700.dp` e a condição de 610 dp no Dashboard preservam ambos os ramos no IR, mas mostram apenas o escolhido. A medida de BoxWithConstraints é atualizada por ResizeObserver no próprio container, não pelo viewport global.
- Wrappers virtuais de condições não ocupam espaço como widgets artificiais.
- A medição de Row usa seu próprio conteúdo, não um `.ad-compose-content` de um painel descendente. Isso corrigiu o texto comprimido. Conteúdo ponderado recebe largura distribuída; o renderer não usa break-all.
- O viewport lógico não perde seis pixels para a borda decorativa. A observação do resize usa contentRect para evitar crescimento cumulativo. 390×844 significa conteúdo de 390×844 CSS px lógicos.
- OutlinedTextField aplica cores de texto, cursor, borda e label conforme foco, além de shape e label flutuante. Estado externo/validação arbitrária não são executados.

A unidade interna é dp lógico, representada por CSS px no dispositivo virtual; fontScale atua sobre sp/lineHeight; zoom do workspace é externo e não altera o modelo. Isso não equivale a pixels físicos Android. Densidade e rasterização de fontes devem ser equiparadas na comparação nativa.

## Propriedades e recursos

O Inspector mostra referência/expressão, valor, status, arquivo, função e intervalos; cadeia ordenada pode ser inspecionada/editada. Propriedades opcionais de apresentação e alterações de instância permanecem no IR e no histórico. Temas MaterialTheme explicitamente resolvidos podem ser editados no modelo com contagem de referências potencialmente afetadas; isso não reescreve automaticamente o arquivo original de tema.

São resolvidos colorScheme/typography/shapes estáticos e parâmetros explícitos; cores Material3 por função/estado são mantidas na metadata. Não se trata isso como herança CSS universal. Apenas condições de tema conhecidas e defaults de parâmetros estáticos são avaliados. Defaults Material3 incompletos dependem da versão e continuam aproximações, não valores nativos comprovados. Gradiente CSS diagonal também é aproximação do shader Compose.

Recursos XML base e values-night, strings/cores referenciadas e PNGs locais continuam suportados. Outras variantes são inventariadas, mas não há seleção geral de locale, densidade ou flavors/source sets. Fontes TTF/OTF locais podem ser carregadas por referência no preview e incluídas na geração; famílias/variantes complexas e métricas equivalentes ao Android não foram comprovadas. Sem fonte/emoji correspondente, existe fallback do navegador — visível nas capturas.

## Preservação e sincronização

O snapshot original permanece imutável. Patches seguros alteram cópias exportadas; fonte modificada após análise, múltiplos usos de um parâmetro, estruturas alteradas e propriedades sem região segura geram conflito. Edição estrutural, estilo compartilhado ou uma cor fixa dentro de helper não são apresentados como round-trip automático: a fonte original fica conservada e o projeto gerado representa o IR editado. Arquivos `agata-original`, `agata-source-edits` e o relatório de importação permitem a revisão.

Reimportar um projeto exportado com agata-model.json recupera o IR e seus IDs/estilos, sem tentar adivinhar novamente a partir do Kotlin parcial. Reanálise explícita continua uma transação de undo. O grafo de constraints acíclico existente permanece; chains recíprocas, barriers/chains externos e solver completo AndroidX não foram implementados nesta correção. DSL não suportada permanece na fonte e na metadata original do Modifier.

## Validação

Rodada final local: **92 testes Python, 46 testes JavaScript e dez fluxos Playwright aprovados**. `compileall`, `check:js` e `git diff --check` também passaram. O comparador de imagens teve self-check com imagens sintéticas; esse self-check não representa validação Android.

- Testes Python em `tests/test_compose_fidelity.py`: três Screens/quatro definições, cores do objeto entre arquivos, callbacks, Modifiers de parâmetros, gradiente e ordem, aliases de condições, Typography/precedência, valores dinâmicos, recursão limitada, patches UTF-8/slots/instâncias, conflito de fonte, recursos noturnos, privacidade de símbolos e exportar/reimportar.
- `tests/spotify_import_ui.cjs`: projeto recebido nos três tamanhos, cores calculadas, texto com largura útil, viewport exato, ramos exclusivos e Home → Login → Dashboard.
- `tests/compose_fidelity_ui.cjs`: caso adicional com NavHost, estilos MaterialTheme, Card com padding externo e tipografia, Inspector com origem, largura fillMaxWidth e condições pelo espaço disponível do container.
- Capturas reais do navegador em `docs/evidence/spotify-import` e `docs/evidence/compose-fidelity`, com medidas dos textos. Essas são evidências web, **não capturas Android nem comparação A/B aprovada**.

## Comparação Android: preparação concreta e pendência

Não há SDK, emulator, adb ou kotlinc neste ambiente. Não foi produzido APK, render Android ou percentual de fidelidade nativa.

`python scripts/build_spotify_reference.py /tmp/SpotifyReference` prepara um projeto independente com os três Kotlin intactos e uma Activity de navegação. O ZIP não define Theme/Activity; o harness declara explicitamente um contexto Material3 escuro. O script não executa Gradle e recusa sobrescrever uma pasta ocupada. Construir e capturar requer Android Studio/JDK17/SDK36. É uma referência de teste, não uma integração de preview nativo já disponível no Agata.

Depois de capturar **somente a área do app** em 390×844, 600×960 e 840×900 dp, com mesmo density/fontScale/tema/estado/fontes, use:

```bash
python scripts/compare_compose_previews.py android.png agata.png \
  --android-context android-context.json --web-context agata-context.json \
  --report comparison.json
```

Pillow é uma dependência opcional apenas dessa ferramenta. Os contextos exigem `viewport_dp`, `density`, `fontScale`, `theme`, `state`, `font_hashes` e opcional `pixel_space: "css"` para imagens web. A ferramenta rejeita contextos divergentes, normaliza pixels físicos para dp e usa blur de 0,5 px e tolerância configurável para antialiasing. Limites iniciais são hipóteses de teste (16/255 por canal, 8% de pixels divergentes), não aprovação automática de equivalência; componentes ausentes/overlap ainda exigem testes estruturais. A comparação nativa permanece pendente.

## Referências verificadas

- [Modifiers e ordem](https://developer.android.com/develop/ui/compose/modifiers)
- [Constraints e Modifiers](https://developer.android.com/develop/ui/compose/layouts/constraints-modifiers)
- [Medição e posicionamento](https://developer.android.com/develop/ui/compose/layouts/basics)
- [Material3, esquemas e tipografia](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [ConstraintLayout Compose](https://developer.android.com/develop/ui/compose/layouts/constraintlayout)
- [BoxWithConstraints AndroidX/AOSP](https://android.googlesource.com/platform/frameworks/support/+/b815b4040523b3ed89496b6a25219bd8543260f6/compose/foundation/foundation-layout/src/commonMain/kotlin/androidx/compose/foundation/layout/BoxWithConstraints.kt)
- Parser continua Tree-sitter Kotlin 1.1.0 / binding 0.26.0 (MIT, notices já existentes). Código AndroidX foi consultado, não copiado. Preview nativo como provider complementar é viável com um processo SDK/Gradle isolado e capturas com contexto; não deve executar projeto desconhecido durante importação e exigiria gestão explícita de build/dependências/dispositivo.
