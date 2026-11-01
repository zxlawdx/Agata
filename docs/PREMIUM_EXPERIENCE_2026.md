# Agata Studio 2026 — Premium Experience & Quality Upgrade

**Branch de revisão:** `feat/studio-2026` · **PR:** [#13](https://github.com/zxlawdx/Agata/pull/13) · **Merge proibido sem autorização**.

Esta revisão é incremental: preserva Vela/Python/JavaScript, modelos de documentos, Monaco offline, GrapesJS e exportadores Android. Nenhum score de UX ou design é aumentado por declaração; é necessário um review visual e funcional independente.

## Auditoria e matriz de decisões

| Problema da revisão | Origem identificada | Mudança / módulo | Teste de aceitação | Limite |
| --- | --- | --- | --- | --- |
| Modo Dividido desperdiça espaço e reduz a tela a miniatura | `ws-layout` dividia três painéis fixos e `ws-editors` restringia o canvas a 50% | `workspace_layout.js`: divisórias acessíveis, proporção ajustável e estado por projeto; CSS com cinco colunas | `workspace_layout_ui.cjs`: arrastar divisórias, persistir, redimensionar em 1366/1920 | Canvas de 1440px ainda depende de zoom para caber em espaços pequenos |
| Zoom alterava quando o canvas era atualizado | `CanvasAdapter.width()` recalculava sempre a escala ao mudar o tamanho do contêiner | `CanvasZoomController` separa viewport lógico de percentual visual e modos Fit Width/Fit Screen/100/custom | zoom e dimensões lógicas testados em navegador | Pan avançado, scroll por touchpad e snapping ainda parciais |
| Toolbars fragmentadas / truncadas | Controles sem hierarquia e sobreposição de quebras de linha | faixa única navegável, grupos por edição/layout/canvas/guias, File/Code separados, opções de Foco, Explorer/Inspector e Reset | capturas before/after, teclado e viewport | Overflow de ícones ainda requer auditoria completa de descoberta |
| Monaco ocupa espaço e formatação não é explicada | minimap fixo, editor sem preferências visíveis | minimap e wrap opt-in, Ir para linha, formatação manual com feedback; não modifica arquivos ao abrir | suíte de Monaco, `workspace_layout_ui` | Formatação de JS/CSS depende dos providers offline instalados; Prettier não foi importado |
| Inspector excessivamente genérico | Todos os grupos CSS apareciam na mesma sequência | orientação para texto/botão/mídia/contêiner; grupos ordenados pelo tipo; busca por propriedade; dados CSS preservados | seleção e filtros reais no navegador | Reset individual e proveniência detalhada de cada propriedade ainda parciais |
| Android Music/Social/Fintech possuem poucas telas | `android.py` gerava 2 screens genéricas | `premium_experiences.py` deriva 3 apps originais de IR editável, cada um com seis telas e eventos válidos | `test_design_system.py`, `premium_android_ui.cjs`, testes Kotlin/Compose e XML em CI | Ainda são modelos demonstrativos; acabamento visual de arte/imagens precisa revisão |
| Labels `onClick` se sobrepõem | overlays sem análise de colisão | `navigation_routes.js`: rótulos por destino com rejeição de interseções entre labels e telas | regressão Android das conexões, screenshots | Não é um roteador ótimo de obstáculos; cruzamentos complexos podem persistir |
| Galeria mostra somente primeira screen e Web sem opções de viewport | endpoint sem índice, modal fixo | `template_gallery_preview` suporta índice Android validado e navegação; Web alterna 390px/mobile e desktop | `test_template_gallery.py`, `template_gallery_ui.cjs` | Android continua esquemático, Web não executa scripts na galeria |

## Três experiências Android originais

A geração utiliza `apps/design_system/services/premium_experiences.py` e os componentes existentes. Cada arquivo gerado preserva IDs estáveis, nós editáveis, responsividade por classes de largura e `design_system.tokens`.

**Sonora — Music Premium:** Home, Search, Library, Playlist Detail, Now Playing, Artist Profile. Conteúdo: cards de playlist, busca, categorias, arte vetorial editável, slider, navegação e controle de reprodução visual por Switch. O toggle NÃO executa áudio.

**Mosaic — Social Premium:** Feed, Explore, Profile, Post Detail, Messages, Notifications. Conteúdo: StoryRow, SocialPost, perfil, galeria abstrata, comentários e controles demonstrativos. Não existe backend de mensagens, seguidores ou posts.

**Nexa Finance — Fintech Premium:** Dashboard, Transactions, Cards, Analytics, Transfer, Profile. Conteúdo: saldos e transações fictícios, gráficos, componentes de cartão, navegação e formulário de transferência simulado. Nenhuma operação bancária é realizada.

`editorial-minimal`, `material-expressive`, `glass-blur` permanecem compatíveis com o template anterior. Os modelos são exemplos criativos originais e **não copiam identidades Spotify, Instagram ou bancos**.

## Contratos de confiabilidade

1. Navegação é parte do documento e não depende de linhas SVG do editor.
2. A preferência visual da IDE nunca altera `project.theme` nem HTML/CSS de sites gerados.
3. Redimensionar painel não altera viewport lógico, breakpoints ou arquivos do projeto.
4. Monaco possui um modelo por arquivo; a origem editada continua sendo HTML/CSS/JS.
5. Arquivos externos e fontes desconhecidas permanecem preservados quando a operação não os afeta.
6. Os arquivos exportados não incorporam GrapesJS/Monaco nem scripts privilegiados da IDE.
7. Previews Web da galeria usam iframe sem permissões de script; Android é um desenho aproximado do IR.
8. Ações com mock data devem ser rotuladas como demonstração.

## Testes e capturas

Execute:

```bash
python -m unittest discover -s tests -v
npm run check:js
node --test tests/*.test.cjs
npm run test:ui
npm run test:studio-ui
```

O CI `.github/workflows/ci.yml` produz artefatos `agata-ux-evidence-<run_id>`. Arquivos esperados, dependendo de aprovação do teste correspondente: `web-split-before-resize.png`, `web-split-resized.png`, `web-canvas-fit-width.png`, `web-canvas-zoom-100.png`, `web-focus-mode.png`, `web-inspector-contextual.png`, `android-premium-music-dark.png`, `android-premium-social-modern.png`, `android-premium-fintech-premium.png`, `template-gallery-android-second-screen.png`, `template-gallery-preview-web-mobile.png`.

Capturas do browser fixture **não** são evidência de build Android no SDK. O próprio Vela e a pywebview nativa Linux também precisam de testes na máquina do usuário.

## Validação Android SDK ainda necessária

Em uma máquina com Android SDK/JDK/Gradle configurados, exportar cada projeto Compose e executar a partir da pasta de app exportada:

```bash
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

Se o módulo exportado usar outro nome, ajustar a task ao projeto gerado; se o projeto não incluir o wrapper Gradle, criar/importar o projeto no Android Studio e realizar o build no ambiente suportado. Validar visualmente em emuladores compact/medium/expanded, com tema Light/Dark, escala de fontes maior e navegação por toque. Registrar hash de build, SDK, dispositivo e screenshots de cada tela. Não declarar compilação Android até essas etapas serem de fato executadas.

## Limitações e trabalho restante

- Layout do editor está mais configurável, mas detalhes de pan avançado e animação de painéis requerem avaliação manual.
- Os três templates são protótipos originais **de conteúdo demonstrativo**, não aplicativos completos conectados a serviços. A fidelidade Material 3 ainda requer Android SDK.
- O preview Android da galeria é esquemático; não é um emulador, Compose Preview nem prova de fidelidade pixel-perfect.
- O Inspector ainda não tem reset individual completo, provenance visual de todos os tokens/overrides nem auditoria de contraste.
- Formatação avançada em múltiplos arquivos/Emmet/Prettier, snippets e atalhos adicionais ainda não foram concluídos.
- Conexões com muitos cruzamentos podem exigir pathfinding externo e agrupamento de edges.
- Integração de templates terceiros continua bloqueada até revisão de licenças separadas de código, fontes, assets e marcas (ver `docs/TEMPLATE_SOURCE_LICENSE_REVIEW.md`).
- Sem teste desktop nativo GTK/Qt, auditoria externa de segurança ou verificação completa de acessibilidade via leitores de tela.
- Não elevar as notas UX/visual apenas porque os testes automatizados passaram.

**Critério final:** manter a branch em review e comunicar os itens parciais com transparência; o PR não será mesclado automaticamente.
