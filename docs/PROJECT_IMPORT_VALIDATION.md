# Validação da entrega

- 76 testes Python: domínio, persistência, gerenciador, importador, recursos, constraints, listas, preservação e exportações.
- 42 testes JavaScript: comandos, transações, snapping, seleção, árvores e controles.
- Oito fluxos Playwright com Chromium e serviços Python isolados: smoke, Android, responsividade/pointer, constraints/tutorial, workflow, undo, importação e listas.
- `compileall`, `npm run check:js` e `git diff --check`.
- Kotlin gerado é analisado por Tree-sitter e XML por ElementTree. Isso valida sintaxe/estrutura, não substitui compilação Android.

## Evidências automatizadas

`tests/test_project_import.py`: exporta Home/Login/Dashboard a partir do template editável (três Screens), gera ZIP real, importa sem criar projeto na prévia, confere IDs/árvore/eventos, confirma snapshot e reexporta preservando fontes desconhecidas. Inclui entradas inválidas, symlinks, cancelamento, cópias editadas, versão de fonte, reanálise, manager, conjunto Kotlin, constraints e conservação de Gradle/MainActivity externos.

`tests/project_import_ui.cjs`: upload real de Kotlin → prévia → workspace → consulta no CodeMirror → edição de cor e texto pelos controles do Inspector → salvar → reabrir → exportar ZIP. Também importa Gradle sem Screens e cria/salva a primeira Screen.

`tests/constraints_ui.cjs`: arrasta âncoras por pointer real, conecta por proximidade fora da hit box, cancela com Esc, rejeita eixo incompatível preservando estado, edita bias e testa Preview e exportação. `tests/undo_ui.cjs` verifica cinco ações de cada editor e undo/redo individuais.

`tests/lists_ui.cjs`: insere os sete tipos pela UI, verifica itens e scroll do Preview, salva/reabre e exporta Compose e XML. `tests/test_lists.py` confere widgets, adapters/layout managers, recursos e parsing do Kotlin emitido.

Capturas: [workspace importado e editado](evidence/project-import/imported-editable-workspace.png), [gesto de conexão](evidence/constraint-interaction/constraints-live-drag.png), [constraints e tutorial](evidence/constraint-interaction/constraints-tutorial.png).

## Limitação de ambiente

Não há Android SDK/sdkmanager ou compilador Kotlin instalado. Nenhum `assembleDebug`/APK foi produzido nem declarado aprovado. O caso Android externo que preserva Gradle e MainActivity está coberto por inspeção e teste de exportação; compatibilidade de plugins/dependências exige sincronização e build no Android Studio. O relatório de exportação mantém `android_build_verified: false`.
