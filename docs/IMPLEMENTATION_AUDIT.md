# Auditoria de implementação — base PR #9

Base real: main `4c3f259`, após PR #9. Python/Vela e pywebview expõem `config/bridge.py`;
`apps/workspace` persiste projetos JSON; `android_designer/domain/model.py` valida/migra IR v3.
Fabric 5.3 offline continua em `sketch_editor`; o editor Android renderiza nós DOM, não Fabric.

| Área | Arquivo/função existente | Constatação |
|---|---|---|
| Modelo/histórico | static/js/model.js, Document.transact/moveNodes/setConstraint | snapshots atômicos, validação local e Python; exclusão de Screen apaga eventos em vez de mostrar correção |
| Render | renderer.js render; designer.js renderWorkspace | usa cópia layered_screen; double-click recebia nó copiado e não alterava o modelo original |
| Constraints | constraint_editor.js redraw; constraints.js solve/layout | solver acíclico real; alças só para filho direto de ConstraintLayout; sem explicação para Column padrão |
| Eventos | designer.js ad-connect, renderWorkspace/renderPreview | dropdown real e conector só na toolbar; linhas saem do frame, sem handle por nó nem wire temporária |
| Geometria | getBoundingClientRect, offsetWidth, transform scale | coordenadas locais corretas na maioria dos casos; overlay dentro do pai sofre clipping/scroll; resize não redesenha alças |
| Peso | field / renderInspector e domain/model.py validate | binding por chave const não troca width/weight; não há evidência de atribuição automática 390. Campo aceita peso em pai inválido até save; faltam ID/valor/contexto no erro |
| Código | CodeMirror local; custom_files, generate/showFile | edição manual explícita existe e é exportada; falta comparação/regeneração/conflito e validação XML manual |
| Desktop | CSS resize horizontal, pointerdown middle | flex-basis fixa pode vencer width; pan em bubbling disputa controles; biblioteca horizontal max-height46 |
| Persistência | InterfaceService revision lock | evita sobrescrever outra janela; modelo e desenhos separados; preferências de viewport salvas explicitamente |
| Exportação | exporters compose/xml/project | fontes Gradle/Manifest/Wrapper reais; nenhuma compilação Android demonstrada |

Não se reimplementam histórico, Fabric, CodeMirror, responsividade ou tutorial. Correções e
extensões devem reutilizar essas fronteiras. Ver CONSTRAINTS_FORENSIC_AUDIT.md e RESEARCH_DECISIONS.md.

## Resultado deste incremento e limites verificáveis

IR v4 acrescenta Shape/DrawingCanvas/Chart e ações estruturadas. Balde escreve propriedades,
Canvas guarda comandos numéricos, gráficos guardam séries/labels. Os templates são árvores
editáveis. Exportadores incluem Canvas/Paint e handlers nativos, sem executar código manual.
Navegação mantém destinos quebrados para correção; exportação bloqueia referências pendentes.

Testes: unidade Python/JS; cinco fluxos Chromium (legado, Android, responsivo, Constraints,
workflow mestre). Capturas `constraints-live-drag.png` e `onclick-drag.png` mostram arrastes
ativos. XML manual é validado estruturalmente; Kotlin gerado é analisado por parser.

**A definição ampla de editor completo ainda não foi atingida.** Este incremento não inclui:
chains/prioridades flexíveis, parâmetros tipados de rotas/transições, emulação de IME/insets,
leitor de tela integral, SVG arbitrário/editor de pontos avançado, grupos vetoriais aninhados,
gradientes/filtros, autenticação real/servidor, animações de loading de rede, gráficos financeiros
ou eixos/formatadores completos. NavigationRail/TabRow/ListItem/Chip/Avatar têm equivalentes
estruturais documentados (Region/Row/Button/Card), não todos os slots Material 3 nativos.
Variações Outlined/Password continuam por propriedades dos componentes existentes; não se
criam tipos duplicados para nomes diferentes. Gráficos bar/column são colunas agrupadas;
scatter usa índice x, progress/gauge usam % inicial. Fontes e baseline podem diferir do Android.

SDK ausente: sem assembleDebug/APK/emulador ou validação de WebViews Windows/Linux. Não se
considera parsing equivalente a build. Exportação de Shape interno não cria eventos por forma
nem referências individuais de acessibilidade; use componentes nativos para interações.
