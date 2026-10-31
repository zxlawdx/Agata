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
