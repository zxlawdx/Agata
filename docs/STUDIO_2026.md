# Agata Studio 2026 — implementação e validação

Estado desta entrega: **primeira versão Web utilizável e fundações Android premium**. A especificação mestre inteira não está encerrada. Os limites abaixo são parte da entrega, não funcionalidades simuladas.

## Abrir e utilizar

Execute o Agata normalmente pelo Vela (`python manage.py runapp`). A navegação oferece Web Studio, Android Studio, SVG, Desenho e Esboço. Os editores existentes permanecem disponíveis.

No Web Studio, escolha um dos oito templates e clique em Novo; ou importe uma pasta, ZIP ou HTML. A importação cria uma cópia e mantém `web-original` intacto. Use Design, Código, Dividido ou Preview. Arquivos HTML/CSS/JS ficam separados, com um modelo Monaco e URI estável por arquivo aberto. Os workers, parsers e canvas são locais: não há CDN nem React/Vue adicional.

Arraste elementos/blocos para o canvas ou para a árvore. No canvas, as bordas superior/inferior inserem antes/depois; o centro insere como filho quando permitido. Flexbox/Grid continuam estruturais. Ctrl/Cmd na árvore permite seleção múltipla; copiar, duplicar, excluir e agrupar usam comandos reversíveis. O Inspector oferece propriedades CSS, media/container queries, estados, edição da declaração original e overrides de instância. Réguas, guias Grid, resize e snap de tamanho são ferramentas do canvas. O snap atual usa múltiplos de 8 px e tamanhos de irmãos, não um sistema completo de alinhamento por arestas.

O editor de gradientes produz CSS linear/radial/conic, com stops, posição e alpha. O painel de animação adiciona keyframes; o Inspector controla duration/delay/direction/fill/iteration. Movimento reduzido desativa animações no preview. CSS complexo continua editável diretamente no código.

Componentes `agata-include` apontam para arquivos HTML reais. Alterar texto/atributos na definição compartilhada altera suas utilizações. Selecionar uma instância no canvas permite restringir CSS ao include; Desvincular instância cria uma cópia local editável e preserva a definição. Componentes com scripts ou srcset exigem revisão manual antes de desvincular.

Salvar grava arquivos reais em `web-root`. Salvar como duplica o projeto. Autosave é configurável entre 5 e 300 segundos; há recovery e até 20 backups, com metadados e arquivos anteriores. Conflitos de revisão ou SHA-256 de arquivos externos interrompem o salvamento. O exportador gera ZIP com HTML/CSS/JS/assets e `agata-web.json`; não inclui Monaco, GrapesJS ou o backend do Agata. Sirva a exportação por HTTP, por exemplo `python -m http.server 8080` na pasta exportada. Módulos ES não devem ser testados por file://.

## Organização

| Domínio | Implementação |
| --- | --- |
| Project Management / storage | `apps/workspace/services/manager.py`, `apps/web_studio/services/projects.py`, `storage.py` |
| Modelo / History and Commands | `web_studio/static/js/document.js`: arquivos autoritativos, nós/IDs/source mappings, patches e transações |
| Template Registry / Design System | `apps/template_registry`, `apps/design_system`; seis estilos Android e oito templates Web originais |
| Canvas / layout | `adapters.js`, `layout.js`, `catalog.js`, `virtual_list.js`; GrapesJS substituível, sem storage/histórico próprio |
| Code Editor / sincronização | MonacoAdapter, parse5, css-tree, es-module-lexer/minimal, `references.js`, `styles.js` |
| Inspector / efeitos / eventos | `inspector.js`, `effects.js`, `events.js`, `library.js` |
| Import/Export / Assets | scanner limitado existente, validação de caminhos, arquivos binários/textuais, ZIP real |
| Preview Runtime | `services/preview.py`: servidor separado com snapshots imutáveis e permissões limitadas |
| Adapter Vela / bridge nativo | `views`, `config/bridge.py`, `config/http_server.py`, `config/native_security.py` |

O modelo expõe `toInterfaceModel()` sem referências DOM/Monaco: plataforma, metadados, arquivos, assets, tokens, componentes, páginas e nós com identidade, parent/children e ranges de origem. HTML/CSS/JS permanecem a fonte autoritativa. Parsing HTML tem cache por arquivo; o canvas reconcilia componentes reconhecidos por ID e atualiza CSS sem regenerar arquivos. Visualizações grandes têm DOM de listas limitado. Alterações em arquivos usam patches; movimentos atualizam links e imports locais reconhecidos.

Não existe promessa de converter JavaScript arbitrário, componentes de frameworks ou Shadow DOM em árvore visual. Trechos desconhecidos são preservados no código. O browser calcula a cascade real; o mapeador mostra declarações de origem reconhecidas, não implementa um segundo motor CSS completo.

## Segurança do preview

O runtime não expõe bridge, caminhos do host, cookies de sessão nem endpoints da IDE. Cada snapshot tem URL imprevisível, versão e nonce; mantém no máximo três versões por sessão, oito sessões e aproximadamente 128 MB de conteúdo agregado. O iframe permite scripts e forms, **sem allow-same-origin**, popups ou navegação do topo. Forms são necessários para disparar eventos submit; CSP restringe seus destinos ao runtime. HTTPS é opt-in, desligado na importação. Console e seleção aceitam somente mensagens da janela esperada, nonce correto e dados conhecidos. O canvas de design não executa scripts de projeto.

Há uma defesa adicional para pywebview: canais nativos de subframes não são autorizados apenas pela existência de `window.pywebview`. O shell Vela recebe uma capacidade efêmera; o dispatcher verifica a capacidade, bloqueia chamadas privadas/dotted e protege callbacks internos. O bootstrap não é salvo em projetos e a resposta do shell usa no-store. Esse adaptador usa o ponto de extensão HTTP do Vela e o dispatcher pywebview; mudanças nessas APIs devem passar pelos testes de segurança. Foi verificado com o código do Vela 44a6df91 e pywebview 6.2.1. GTK/Qt/CEF reais ainda precisam de smoke tests por plataforma.

Scripts continuam podendo consumir recursos do próprio runtime; sandbox não representa quota rígida de CPU/memória de JavaScript. Não são executados no backend nem no documento privilegiado. Limites de arquivo, importação, sessões, caminhos e uploads são validados separadamente.

## Estado por fase

| Fase | Entrega verificável | Evidência | Limites / pendências |
| --- | --- | --- | --- |
| 0 Auditoria | Stack/entrypoint/modelos/histórico/importadores/exportadores e riscos mapeados; pesquisa/licenças | `STUDIO_2026_AUDIT.md`, `STUDIO_2026_RESEARCH.json`, `STUDIO_2026_TECHNOLOGIES.md` | Metadados de atividade são uma fotografia da data de pesquisa |
| 1 Foundations | Projeto Web, IR/source mappings, registries, tokens e rota Vela | testes de domínio, projetos e design system | Migração Web suporta schema 1; versões desconhecidas são rejeitadas |
| 2 Web MVP | Catálogo versionado com 141 tags, arquivos reais/CRUD, canvas, Monaco, preview, save/reopen/ZIP | `web_studio_ui`, `web_monaco_ui`, `web_imported_blocks_ui`, testes Python | Catálogo identifica tags obsoletas/não visuais; não é um validador completo de todas as regras HTML |
| 3 Layout | Flex/Grid, reordenação, centralização contextual, auto layout, tracks/propriedades, resize, réguas/guias e snap de tamanho | `web_document.test.cjs`, `web_studio_advanced_ui` | Não há snapping completo por arestas/distâncias, edição por handles de cada track nem rotação de grupo dedicada; transforms são editáveis no CSS |
| 4 Sincronização | AST HTML/CSS, lexer de imports, patches mínimos, versões, origem de declaração, instâncias, conflitos e preview | testes de patches, conflitos, preservação, Monaco, importação e reabertura | Seletores/cascades avançados permanecem sob o browser; estilos inline, imports dinâmicos e estruturas não reconhecidas podem exigir edição de código; source mapping não reconstitui lógica JS |
| 5 Templates Web | Oito templates, três páginas e componentes/CSS/JS/assets separados por projeto | round-trip dos oito; renderização 375/1440 px, screenshots e overflow | Autenticação, dados, pagamentos e mensagens são UI/demonstrações locais: conecte serviços reais |
| 6 Android premium | Seis estilos, duas telas/navegação, 22 composições editáveis, tokens, tema Compose, cinco classes de largura e presets | `test_design_system.py`, `premium_android_ui.cjs`, análise sintática Kotlin | **Parcial**: player/miniplayer não têm motor de áudio; Glass usa fallback opaco; fontes personalizadas, postura/hinge de dobráveis e componentes adaptativos mais avançados não estão completos; falta build/execução com SDK |
| 7 Motion/polish | Gradientes CSS, keyframes/timeline básica, redução de movimento; fade/scale/slide/expand Compose; overlays Compose | `web_effects_ui.cjs`, contratos de componentes/exportação | Timeline não é um sequenciador completo; AnimatedContent/springs/transições de estado Android não são uma biblioteca completa; overlays têm preview HTML aproximado |
| 8 Hardening | Regressão, proteção nativa, CSP, importação limitada, hashes/licenças e testes CI | testes Python/JS/Playwright e inventário vendor | Sem medição Android nativa, auditoria externa de segurança ou matriz completa de engines desktop; screenshots são evidência, não comparação pixel-perfect automática |

## Android: utilização e limites

Na criação Android, escolha Music Dark, Social Modern, Editorial Minimal, Fintech Premium, Material Expressive ou Glass / Blur. O painel Premium Design System insere composições e altera tokens JSON. Propriedades sobrescritas no Inspector se desvinculam do token correspondente. A exportação inclui `AgataTokens.kt`, Typography, tema e modelo reimportável. Material Expressive usa papéis MaterialTheme quando Dynamic Color está habilitado.

As classes seguem largura disponível em dp: compact <600, medium 600–839, expanded 840–1199, large 1200–1599, extraLarge ≥1600. Overrides legados expanded continuam como fallback. Compose usa condições locais BoxWithConstraints; XML recebe qualifiers adicionais. Os presets não detectam fisicamente a dobradiça de um aparelho.

NavigationRail, BottomNavigation, Dialog e BottomSheet têm saída Compose nativa; estado inicial de overlay pode ser definido por `states.initialVisible`, com descarte por dismiss. Fade/scale/slide/expand respeitam a preferência do projeto e a escala de animação do sistema. XML usa fallback estático para motion e emite diagnóstico. **Análise sintática Kotlin não prova compilação, comportamento ou fidelidade nativa.** O exportador continua declarando `android_build_verified: false`.

## Reproduzir as verificações

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m unittest tests.verify_static_paths -v
npm run check:js
node --test tests/*.test.cjs
npm install --ignore-scripts
npx playwright install chromium
npm run test:studio-ui
```

A CI também executa as dez suítes de UI anteriores: desenho, Android, constraints, workflow, undo, importação, listas e fidelidade Compose. O transporte HTTP em `tests/ui_server.py` é fixture de testes; não é publicado no aplicativo. O teste `native_shell_ui.cjs` usa o shell real e simula apenas o canal nativo para validar bootstrap/autorização.

Os assets de produção já estão no repositório. Para reconstruí-los somente em desenvolvimento:

```bash
npm ci --prefix scripts/web-editor --ignore-scripts
node scripts/web-editor/build.cjs
node scripts/web-editor/catalog.cjs
```

O inventário `apps/web_studio/static/vendor/NOTICE.json` registra versões, licenças, bytes e SHA-256. O startup verifica a distribuição sem instalar ferramentas. DOMPurify foi fixado em 3.4.17, incluindo a substituição do import interno do Monaco no esbuild; há teste no bundle final, além de npm audit.
