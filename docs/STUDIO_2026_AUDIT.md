# Fase 0 — auditoria e estratégia Agata Studio 2026

## Arquitetura confirmada

Entrypoint `manage.py` usa CommandRunner do Vela. `config/wsgi.py` coleta assets offline e cria VelaApp com AgataBridge; views registram rotas e render_template. API local Bottle/Waitress, desktop pywebview. Frontend é HTML/CSS/JavaScript direto, sem React/Vue. `staticfiles` é saída gerada de collectstatic e não é fonte editável.

Persistência: JsonProjectRepository com arquivos atômicos, registro de recentes/locais externos, ProjectService e serviços Android/Sketch separados. IR Android v4 contém Screens/nós/constraints/eventos/camadas; `compose` é extensão opcional de origem/estilos. Sketch usa Fabric 5.3.0 com árvores de objetos e comandos próprios. CodeMirror permanece no Android. Exportadores Compose/XML são independentes do DOM. Importação ZIP usa scanner limitado, sem executar Gradle/Kotlin. Undo Android é transação por ação; correção de componentes Sketch já tem testes de cinco operações.

Módulos reaproveitáveis: notificações, diálogo/gerenciamento de projetos, scanner de arquivos/ZIP, persistência/revisões, renderer e registries Android, presets e exportadores, serviços de assets e SHA-256. Snapping/manipulação Fabric serve ao desenho; DnD Android é estrutural e fornece padrões de UX, não deve ser aplicado como coordenadas absolutas a HTML.

Acoplamentos: AgataBridge reúne chamadas de vários domínios; controllers DOM têm responsabilidades amplas; histórico Android ainda usa snapshots por transação; templates Android são funções ligadas ao registro. Introduzir serviços e adaptadores Web separados evita expandir esses controllers. Não reescrever migrações e modelos que já funcionam.

## Decisões investigadas antes de instalar

- Monaco 0.57.0: MIT, sem framework frontend, ESM e workers separados; pacote de desenvolvimento ~102 MB descompactado. Distribuir somente build minificado de core + HTML/CSS/JS/JSON e workers, com licenças e SHA-256; Node continua ferramenta de desenvolvimento, não requisito de execução.
- GrapesJS 0.23.8: licença confirmada no LICENSE e npm como BSD-3-Clause (API GitHub retornou NOASSERTION). Canvas/seleção/DnD/resize/estados como adaptador substituível; sem Studio SDK proprietário, sem storage remoto/telemetria/CDN. Modelo de arquivos, patches e histórico permanecem no Agata.
- parse5 8.0.1 (MIT, ~337 KB no pacote): AST HTML com correção HTML5 e source locations, compilado para browser/Node de testes.
- css-tree 3.2.1 (MIT, ~1,36 MB no pacote): AST CSS e posições; browser resolve a cascade real no canvas. Não tratar regex como parser CSS.
- es-module-lexer: MIT, lexer estrutural para diagnósticos de imports. Não executar JS no backend.
- esbuild: MIT, somente tooling para bundles locais substituíveis.

As medidas acima são metadados dos pacotes, não o peso final distribuído. O script de vendor medirá e registrará os arquivos realmente incluídos.

Craft.js, shadcn e Builder implicam React/SDK maior; não introduzir outro framework. Webstudio é AGPL-3.0; OmniTune é GPL-3.0; codi.link tem CC-BY-NC-ND-4.0 no LICENSE. Não copiar seus códigos/assets. Usar somente ideias de organização e comparação. Android official samples/Now in Android/SpatialFlow têm Apache-2.0, mas os novos templates serão originais. W3Schools/MDN são referências, sem copiar textos/templates proprietários. Fontes, ícones e artwork distribuídos serão originais ou licenciados com atribuição explícita.

## Migração e limites de responsabilidade

Novo domínio `web_studio`: modelo de arquivos/nós, comandos de patches, versões, parser adapters, storage e preview. Rotas/bridge Vela são adaptadores. Um Monaco model por arquivo/URI; arquivos reais no workspace e exportação completa. Canvas GrapesJS usa representação sanitizada, sem executar JS do projeto; não é fonte de verdade nem substitui o editor Android.

Preview de execução em servidor loopback distinto, somente snapshots de projeto, iframe `allow-scripts` sem `allow-same-origin`, CSP restrita, sem bridge/credenciais do editor; mensagens validadas por origem de janela/sessão e capacidades limitadas. JS de usuário nunca entra no documento privilegiado. Código-fonte permanece preservado; operações visuais usam patches locais/overrides e rejeitam conflitos de versão.

Design System/Template Registry compartilhados por plataforma e tokens originais. Android ganha seis famílias editáveis e classes de janela ampliadas; recursos sem equivalente nativo terão fallback/diagnóstico, não falsa paridade. Web ganha oito templates modulares, catálogo versionado, controles CSS genéricos, gradiente/animação e preview real.

Riscos principais: mudanças de rota/criação, assets/worker URLs no desktop, perda de comentários no round-trip, loops design↔code, exposição do bridge no preview, quebra do undo, custo de bundles grandes e desempenho de listas. Validar por testes de domínio, segurança e Playwright mantendo a suíte existente. Compilação Android continua dependente de SDK; preview HTML não prova render nativo.

Fases serão commits/revisões verificáveis: foundations/storage; Web editável/código/preview; layout e patches; templates/tokens/Android; animações; regressão/segurança/licenças. Matriz final distingue implementado, limitado e não validado.
