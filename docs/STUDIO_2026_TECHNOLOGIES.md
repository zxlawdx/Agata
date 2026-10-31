# Seleção de tecnologias — 31/10/2026

As datas de atividade e licenças verificadas estão em `STUDIO_2026_RESEARCH.json`. Não foram copiados códigos ou assets com restrições incompatíveis. Os templates e o artwork são originais.

| Projeto | Função / compatibilidade | Licença verificada | Peso, manutenção e decisão |
| --- | --- | --- | --- |
| [compose-samples](https://github.com/android/compose-samples) | Padrões Compose, estado, navegação e composição | Apache-2.0 | Referência oficial ativa; integrar ideias sem adicionar os aplicativos inteiros |
| [nowinandroid](https://github.com/android/nowinandroid) | Arquitetura modular/adaptativa Android | Apache-2.0 | Referência de organização; stack e build grandes não foram importados |
| [SpatialFlow](https://github.com/MythicalSHUB/SpatialFlow) | Linguagem visual e composição Android | Apache-2.0 | Referência; nenhum código ou identidade incorporados |
| [OmniTune](https://github.com/soupashh-ship-it/OmniTune) | Player/UI musical | GPL-3.0 | Somente avaliação; sem redistribuição de código/assets |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | Canvas/seleção/DnD, vanilla JS compatível | BSD-3-Clause | 0.23.8 local; adaptador removível. Storage/undo/telemetria próprios desligados. Backbone-undo é dependência transitiva depreciada, não o histórico do Agata |
| [Webstudio](https://github.com/webstudio-is/webstudio) | Referência de editor Web e CSS | AGPL-3.0 | Aplicativo/stack próprios; não incorporado |
| [Craft.js](https://github.com/prevwong/craft.js) | Editor por componentes React | MIT | Exigiria React; atividade verificada menos recente. Não escolhido |
| [Monaco](https://github.com/microsoft/monaco-editor) | Editor HTML/CSS/JS, modelos, workers, formatação/diagnósticos | MIT | 0.57.0; build seletivo local, URI por arquivo. TypeScript worker é a maior parcela do bundle, necessário ao serviço JS |
| [Moveable](https://github.com/daybrush/moveable) | Manipulação/resize/snapping | MIT | Avaliado; não adicionado. Reutilização do canvas e serviços de layout reduz dependências; paridade completa não é declarada |
| [codi.link](https://github.com/midudev/codi.link) | Referência de split/preview | CC-BY-NC-ND-4.0 no LICENSE | Não copiar; sem código incorporado |
| [Builder](https://github.com/BuilderIO/builder) | Editor/SDKs visual development | MIT no repositório avaliado | SDK/ecossistema maior; não substitui o Agata |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Referência de componentes e [blocks](https://ui.shadcn.com/blocks) | MIT | Ecossistema React; não adicioná-lo apenas para templates. Novos blocos são HTML/CSS/JS originais |

## Dependências efetivamente selecionadas

parse5 8.0.1 (MIT), css-tree 3.2.1 (MIT), es-module-lexer/minimal 3.0.4 (MIT), Monaco 0.57.0 (MIT), GrapesJS 0.23.8 (BSD-3-Clause). esbuild 0.28.2 é tooling, não requisito de produção. Licenças transitivas são distribuídas em vendor/licenses, com notices do Monaco. O bundle completo selecionado ocupa aproximadamente 15,8 MB, com workers, CSS, fonte e licenças; não se confunde com o tamanho descompactado dos pacotes npm.

A seleção preserva o frontend JavaScript existente. Bibliotecas não são serviços de domínio: parsers são injetados, o canvas é adaptador, arquivos e comandos pertencem ao Agata. A substituição de uma biblioteca não exige migrar projetos para o formato de GrapesJS ou Monaco.

Segurança/manutenção: versões e lockfile fixados; verificação SHA-256 no startup; nenhum download em execução; scripts de projeto somente no runtime isolado; quotas de importação e snapshot. `npm audit` inicialmente encontrou DOMPurify vulnerável. A versão 3.4.17 foi fixada e o import interno já empacotado pelo Monaco foi redirecionado no build. Só corrigir o lockfile seria insuficiente. O inventário e teste do bundle verificam a versão efetivamente distribuída.

## Referências técnicas

- [Androidify e Material Expressive](https://android-developers.googleblog.com/2025/05/androidify-building-delightful-ui-with-compose.html)
- [Window size classes oficiais](https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes)
- [Monaco](https://microsoft.github.io/monaco-editor/) e documentação/código da versão instalada
- [GrapesJS](https://grapesjs.com/docs/) e tipos da versão instalada
- [MDN HTML elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements), [MDN CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference), [W3Schools tags](https://www.w3schools.com/tags/default.asp)
- [DOMPurify 3.4.17](https://github.com/cure53/DOMPurify/releases/tag/3.4.17), [advisory corrigido](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7)

O catálogo HTML usa nomes de tags do dataset versionado do Monaco/vscode-html-languageservice; não copia textos de documentação. Semântica de inserção é validada para o subconjunto reconhecido. Recursos obsoletos ficam identificados e fora da biblioteca padrão.
