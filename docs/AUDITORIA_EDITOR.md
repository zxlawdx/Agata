# Auditoria do editor — implementação Android inicial

Base: main após o PR #6, commit `57b2a71aa8bc169140c61fc9d5f6aa0f2c4fa756`.
Especificação: AGATA_MASTER_IMPLEMENTATION(1).md, que substituiu os prompts anteriores durante esta execução.
Baseline de regressão: 27 testes Python e 20 JavaScript passaram. O código existente foi auditado antes de integrar o novo ambiente.

## Inventário e decisões

| Área | Estado na base | Evidência / decisão |
|---|---|---|
| Fabric local | Existente, defeituoso no Windows | A licença canônica tem SHA d8f93c…9702. Somente converter LF→CRLF resulta exatamente em 4369f3…c72, hash relatado. `.gitattributes` fixa LF, e o verificador normaliza apenas CRLF da licença antes de comparar o hash canônico. Não aceita mudanças no texto. |
| Toast | Defeituoso | `editor.js:message` apenas preenchia o nó e o mantinha visível. Serviço comum agora cancela timers, expira sucesso em 4 s, preserva erros e permite fechar/copiar quando clipboard nativo disponível. |
| Componentes Fabric | Existente / parcial | `components.js`, `component_edit.js`, `element_tree.js` já possuem textos/vetores separados e edição de partes. Não foram descartados nem reescritos. Não são um modelo Android. |
| Persistência | Existente / parcial | `SketchService.save` grava `screens[0]`. `ProjectService` cria uma Screen com elementos vazios. Não há estrutura semântica exportável. |
| Android XML / Compose | Ausente | Os exportadores anteriores apenas produzem SVG/PNG/JSON de arte. O painel técnico informava indisponibilidade. |
| Múltiplas Screens / Preview | Ausente | Introduzidos sobre o IR independente, não pela clonagem do canvas Fabric. |
| Editor de código | Ausente | CodeMirror 6 incorporado como bundle local, com licenças e lockfile de desenvolvimento. |
| Android Studio / APK | Ausente | Agora há projetos fonte e Gradle Wrapper. Build Android/APK continuam sem validação neste ambiente, que não possui SDK. |

## Separação que preserva projetos

`apps/android_designer` acrescenta o modo **Interfaces Android**, acessível pelo botão do editor de desenho.
Ele lê/grava `interface_document` e `interface_revision` dentro do projeto existente. As propriedades
`screens`, desenhos/camadas e demais dados legados são preservadas. A migração é aditiva: não tenta
deduzir componentes Android de caminhos Fabric. A ação **Desenho** retorna ao editor anterior.
Isso é uma decisão incremental explícita; não constitui conversão automática de desenhos existentes.

A interface Android é alimentada por uma árvore semântica única: edição, Inspector, Preview, código e
exportadores usam esse documento. Histórico local usa snapshots limitados a 100 transações. Revisão
otimista evita sobrescrever uma interface salva por outra janela do mesmo aplicativo.

## Entrega verificada e alcance

| Funcionalidade | Status | Validação / limite |
|---|---|---|
| Correção da licença no Windows | Implementado | Transformação reproduz o hash relatado; LF/CRLF e alteração inválida testados. Windows real não disponível. |
| Notificações | Implementado | Timer, substituição, fechamento, erros e dispose testados; expiração real no Chromium. Clipboard depende da capacidade Vela e não foi testado nativamente. |
| IR versionado / schema / migração aditiva | Implementado | Validação de IDs, tipos, limites, destinos, namespace, caminhos; round-trip conserva desenhos antigos. Schema JSON estrutural acompanha a validação semântica Python. |
| Screens livres | Implementado / parcial | Criar, renomear, mover, duplicar, excluir; IDs novos e remoção de referências; pan por scroll/botão central, zoom, grade e fit. Não é canvas matematicamente infinito: área cresce com Screens, com limite validado de coordenadas. |
| Filhos editáveis / Inspector | Implementado no novo modelo | Texto e ícone independentes, papéis e árvore, propriedades de conteúdo/estilo/layout/eventos. Sem desagrupar Card. Biblioteca e desenho anteriores preservados. |
| Histórico / seleção múltipla / copiar-colar | Implementado / parcial | Snapshots, Ctrl/Meta para múltipla seleção de nós, copiar/colar entre Screens, duplicar e reordenar. Sem seleção múltipla de frames nem auto-layout avançado. |
| Conexões | Implementado / parcial | Arrastar controle até Screen persiste evento no componente; linha editável seleciona origem, esconder/mostrar e destino via Inspector. Âncora visual na borda do frame, não na geometria exata do botão; atualização após concluir movimento. |
| Preview | Implementado para slice | Campos, pesquisa/limpar, botões, navegação e pilha Voltar/Reiniciar. Sidebar aparece como painel no preview web; não simula Drawer nativo completo. |
| Código | Implementado / parcial | Kotlin/XML/JSON, cores, linhas, indentação, pesquisa/substituição CodeMirror. JSON→Design é o único round-trip suportado. Rascunho JSON é preservado enquanto montado; conflitos de Design são diagnosticados. Sem parser Kotlin→Design ou LSP/compilador Kotlin integrado. |
| Código personalizado | Implementado | Overrides explícitos separados por backend, preservados na persistência/exportação. Não executados no Preview. Não há merge automático de alterações geradas dentro de arquivo customizado. |
| Layout e temas | Parcial | Row/Column/Box, fill/wrap/tamanho, padding, gap, alinhamento, peso em Row/Column sem scroll; tema primário/dark/dynamic color no Compose. Sem catálogo completo de tokens, constraints/min-max nem fidelidade total entre DOM/Android. |
| XML | Implementado / parcial | Layouts nativos e Material declarados; Activity Kotlin com navegação e back stack. Top/Bottom/Sidebar são painéis LinearLayout no XML inicial, não Drawer/BottomNavigationView completos. |
| Kotlin/Compose | Implementado como geração de fonte | Componentes, estado, recursos, Navigation Compose, tema, Activity, dependências e wrapper. Sintaxe, recursos e goldens validados; compilação Android não executada. |
| SVG/PNG/JSON existentes | Preservado | Suíte anterior testa criar/desenhar/salvar/reabrir/exportar. O modo Android novo não rasteriza seu IR em SVG/PNG nesta etapa. |
| Eventos avançados / assets e camadas | Planejado | Apenas onClick navigate/back exportável inicialmente. onChange/onSubmit/longClick configuráveis, catálogo de assets/licenças por projeto e novas camadas nomeadas no IR não estão implementados. |
| Responsividade / hardware | Parcial | Web Chromium testado. Painéis têm resize/scroll; layout estreito usa rolagem interna, sem drawer móvel dedicado. WebView Windows/Linux, DPI, touchscreen e mesa física não testados. |

## Qualidade e riscos restantes

- 42 testes Python, teste adicional de static(), 25 JavaScript e duas suítes UI Chromium passaram localmente.
- A suíte Android exercita edição de título/ícone/label, conexão arrastada, Preview, duplicar/excluir/undo/redo, movimento/zoom, salvar/reabrir, JSON→Design, arquivo personalizado e ZIPs XML/Compose.
- O parser tree-sitter valida sintaxe Kotlin/KTS, não resolução de tipos nem APIs Android. Não equivale a `assembleDebug`.
- Nem toda combinação de propriedades ou componente adicional passou por UI e runtime Android. A matriz de backends registra essas diferenças.
- APIs Material que ainda exigem opt-in são explicitamente anotadas; sua existência na dependência estável não significa API livre de anotação experimental.
- Código customizado pode invalidar um projeto Android. É preservado com identificação explícita e sem promessa de compilação automática.
- Histórico é local e não persiste entre sessões. Sem autosave, gestão de branches de código ou sincronização colaborativa.

Evidências de teste com dados fictícios: `docs/evidence/android-design.png`, `android-preview.png`,
`android-code.png`. A captura `workspace-before.png` documenta os problemas da etapa anterior.
