# Agata Studio — revisão crítica do canvas (PR #13)

Status: **implementação incremental em andamento; verificação nativa Windows obrigatória**. O resultado dos testes GitHub Actions/Chromium não substitui testar Agata Desktop com pywebview e escalonamento de tela Windows.

## Sintomas fornecidos pelo usuário (Windows)

- Pan com mouse não intuitivo/inexistente, Space+arrastar sem suporte consistente no iframe.
- Canvas sem a superfície turquesa e grade de pontos da identidade Agata.
- Zoom, rolagem e viewport lógico confundidos ao atualizar um projeto.
- Flex/Grid sem reposicionamento visual claro; movimento livre precisa ser operação consciente.
- Split com pouca área útil para Monaco, barra de ferramentas sobrecarregada.
- Layers plano mostrando `footer,strong,p,a,header,nav,div`, sem hierarquia/nome amigável.
- Sonora, Mosaic e Nexa funcionais como arquivos, mas visualmente inferiores aos aplicativos de referência.

## Código e escopo desta revisão

- `apps/web_studio/static/js/canvas_interaction.js`: controlador para middle-button pan e Space+left pan, captura de ponteiro dentro do iframe e da viewport, wheel+Ctrl para zoom, separação do zoom e do documento, reset pan, centralização, grade, snap e drag livre explícito.
- `apps/web_studio/static/js/adapters.js`: proíbe o reset do zoom em `CanvasAdapter.width`, conecta eventos do iframe, preserva IDs HTML e `locate` para Layers.
- `apps/web_studio/static/js/studio.js`: exibe modos Livre/Responsivo e árvore Layers hierárquica com indentação, busca, colapso, nomes funcionais, rename de label somente em metadados, reordenação e seleção compartilhada.
- `apps/web_studio/static/studio.css`: tema/grade azul renderizados apenas nos componentes do editor, sem reescrever o HTML/CSS do projeto. Painéis com mínimos em Split.
- `tests/agata_canvas_gestures_ui.cjs`: capturas sequenciais dos cinco pans, Space pan, zoom, grid, free CSS drag e persistência.

**Semanas/iterações posteriores:** nenhum teste Chromium prova que middle-pointer está livre de interceptações do host pywebview no Windows; testar em Desktop Windows a 100% e 125% (DPI real).

## Política de layouts

- **Responsivo (padrão):** GrapesJS e `WebDocument.move` reordenam nós; ações de layout escrevem CSS Flex/Grid/Gap/Alignment e preservam flow.
- **Livre (opt-in):** selecione um item dentro de um contêiner mapeado, clique `Preparar contêiner` (define somente `position: relative` do container), alterne para `Livre`, depois arraste o item. Esta ação torna o item `position: absolute`, com coordenadas e snap em px no próprio `css/overrides.css`. Não converte silenciosamente o contêiner Flex/Grid. Sempre existe `Ctrl+Z` com comando transacional.
- **Limite importante:** um item com constraints complexas ou múltiplos transforms preexistentes requer política especializada. A semântica CSS Free não representa automaticamente o Compose Android.

## Pesquisa de referências Android e licenças (sem incorporação)

| Referência | Página | Licença (nível do projeto) | Aprendizado permitido sem cópia |
| --- | --- | --- | --- |
| Lune | https://github.com/MrDemonc/Lune | GPL-3.0 (verificar arquivo LICENSE e licenças separadas dos assets antes de qualquer reuso) | Hierarquia entre player/controles, cor dinâmica, superfícies Material 3 Expressive e dark mode |
| Resonate | https://github.com/kimhabkhun/resonate | MIT conforme README; fontes citadas em OFL | Biblioteca, player, mini-player com seek, tipografia contextual, tablet com coluna centrada |
| Now in Android | https://github.com/android/nowinandroid | Verificar LICENSE/NOTICE por módulo e por asset | Material 3, design adaptativo, Navigation Compose, estado unidirecional e layouts amplos |
| compose-samples | https://github.com/android/compose-samples | Apache-2.0 em exemplos oficiais, verificar arquivos individuais | Exemplo de Grid de Jetsnack, duas colunas/adaptação Jetcaster, componentes com tamanhos acessíveis |

Esta pesquisa **não autoriza copiar artwork, logos, capturas, ícones, marcas e tipografia** indiscriminadamente. Nenhum código nem asset desses repositórios foi copiado para Sonora, Mosaic ou Nexa nesta etapa. A qualidade premium precisa de uma revisão visual dedicada e validação Android SDK.

## Checklist real de aceitação Windows

| Cenário | Exigência |
| --- | --- |
| Pan médio | Cinco ações de pointerdown/move/up e deslocamento da página, sem seleção/drag de componentes |
| Space + esquerdo | Estado visual de mão aberta/fechada; sem alterar CSS |
| Zoom | 35%, 100%, 150%; fit largura/tela; Ctrl+Wheel ancorado e limites 20-300% |
| Grid | Mostrar/ocultar, spacing e snap; CSS exportado idêntico |
| Livre | Seleção mapeada, container preparado, deslocamento real, handles, CSS correto, undo/redo, save/reopen |
| Responsivo | Reorder Flex/Grid, CSS responsivo preservado |
| Layers | Hierarquia, colapso, pesquisa, rename sem alterar tag, drag/reorder, locate, sincronização Canvas/Inspector |
| Layout | 1366x768 e 1920x1080, escalas Windows 100/125%, sem truncamento ou texto vertical |
| Android | Sonora/Mosaic/Nexa mobile 390x844 dp, tablet, export Kotlin validado no SDK |
| Regressão | Editor Android original e Web Monaco/preview/export preservados |

**Bloqueadores de conclusão:** evidência nativa Windows inexistente neste ambiente; teste Android SDK não executado. O PR continua em draft e sem merge.
