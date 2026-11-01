# Agata Studio 2026 — continuação do PR #13

Data de implementação: 31/10/2026. Branch: `feat/studio-2026`. **Não realizar merge sem autorização.**

## Objetivo

Expandir a especificação de 1221 linhas para além dos bloqueadores P0, preservando o Vela Framework, Python, DOM/JavaScript e os editores existentes. Tratar somente comportamento comprovado em navegador/CI como validado. Não confundir preview de template e app compilado.

## Mudanças implementadas em código

| Fase | Área | Entrega | Verificação |
| --- | --- | --- | --- |
| P0 | Android navigation / constraints | Overlay separado e oculto inicialmente; vínculos preservados; Flow Map independente | `tests/project_wizard_ui.cjs`, `tests/android_ui.cjs`, `tests/constraints_ui.cjs` |
| P0 | New Project | Filtro de template por plataforma; Web pelo `WebProjectService` e `/web`, não pelo `ProjectService` Android | `tests/project_wizard_ui.cjs` |
| P0 | Web vazio | Estado inicial, orientação de criação/importação, estado de erro recuperável | `tests/ux_heuristics_ui.cjs` |
| P1 | Identidade | Cores Agata creme/ciano/rosa, outlines e controles, preservação das artes do projeto | `tests/ux_heuristics_ui.cjs` |
| P1 | Tema | Light/Dark/System para Home, Android, Web e Sketch/SVG (cromia da IDE); Monaco sincronizado; tema do app permanece independente | `tests/project_wizard_ui.cjs`, `tests/ux_heuristics_ui.cjs` |
| P1 | Toolbar + componentes | Operações de edição agrupadas em uma faixa navegável; elementos HTML e blocos agrupados por categoria e filtráveis | `tests/ux_heuristics_ui.cjs` |
| P2 | Template Gallery | Cards visualizáveis com busca, plataforma, categoria, autor/licença/versionamento básico; preview seguro com HTML/CSS real Web ou nós Android esquemáticos, ação de criar projeto real | `tests/test_template_gallery.py`, `tests/template_gallery_ui.cjs` |
| P3 | HTML/CSS/JS | Monaco offline, modelos por arquivo, canvas GrapesJS, source patches, CSS Inspector, preview JS isolado (base existente), categoria de componentes nova | `tests/web_code_sync_ui.cjs` e testes Web preexistentes |
| P4 | Evidências | Capturas automatizadas de galeria, troca de temas, modos, overlays Android e templates responsivos; upload ZIP pelo GitHub Actions | `.github/workflows/ci.yml` |

## Detalhes da galeria

Os itens são obtidos de `apps/template_registry/registry.py` + `apps/android_designer/domain/templates.py`. Atualmente são **oito projetos Web originais**, **seis composições premium Android originais** e starters Android já existentes. O preview Web vem de `template_files(template_id)`, com arquivos CSS incorporados em uma página estática e componentes HTML reutilizáveis expandidos; scripts são removidos e o iframe usa `sandbox=""`. Isso não executa JavaScript do usuário na Home.

O preview Android é uma representação **esquemática**, gerada a partir de `template_document(template_id)`, e não promete fidelidade do Android SDK. O botão *Usar modelo* abre o wizard filtrado; criar gera projeto editável real. Não foram importados templates comerciais nem repositórios open source de terceiros.

## Heurísticas de Nielsen (revisão testável)

| Heurística | Evidência / critério | Estado |
| --- | --- | --- |
| Estado do sistema | Loading, empty, ready, error; status de salvar e alterações | Parcial: Android/Web cobertos, nem todos os fluxos |
| Linguagem familiar | Plataforma Android/Web/SVG/Sketch e campos contextuais | Parcial |
| Controle/liberdade | Undo, redo e fechamento de modais; conexão ocultada sem exclusão | Testes de regressão; UX nativa pendente |
| Consistência | Selected states, theme selector, mesmas famílias de tokens | Parcial: modais e contraste ainda precisam auditoria |
| Prevenção de erro | Wizard filtra combinações, backend valida template, preview sandbox | Em teste |
| Reconhecimento | Galeria visual, filtros de categoria e botão prévia | Em teste |
| Eficiência | Busca de componentes, Monaco, atalhos, grupos em toolbar | Parcial |
| Minimalismo | Toolbar Web com rolagem horizontal e separação de ações | Parcial |
| Diagnóstico/reparo | Falha no bootstrap com retorno Home, tentativas de recarregar | Parcial |
| Ajuda/documentação | Labels acessíveis e documentação do projeto | Parcial |

## Evidências de captura previstas no CI

- `template-gallery-all.png`
- `template-gallery-preview-web.png`, `template-gallery-preview-android.png`
- `template-gallery-created-web.png`, `template-gallery-created-android.png`
- `web-code-sync-editor.png`, `web-code-sync-preview.png`
- `web-studio-no-project.png`, `web-studio-ihc-light.png`, `web-studio-ihc-dark.png`
- `android-navigation-hidden.png`, `android-navigation-visible.png`, `android-constraints-separated.png`
- `android-premium-music.png` e `web-template-*.png` (8 templates × 2 dimensões)

Artefatos são publicados pela action `Publish browser screenshots and UX evidence` quando os testes que produzem as capturas são executados. O diretório de arquivos é `/tmp/agata-evidence` **somente no runner**. Não interpretar a lista como prova de que todos foram gerados até confirmar os artefatos da execução correspondente.

## Limitações declaradas

- Sem validação real de compilação Android SDK nem teste gráfico na pywebview nativa Linux neste ambiente.
- Galeria não usa thumbnails Android nativas; é visualização baseada no documento e pode divergir do layout Android.
- Reuso de repositórios externos não foi implementado; consulte `docs/TEMPLATE_SOURCE_LICENSE_REVIEW.md` antes de importar.
- Não há garantia de sincronização sem perda com JS arbitrário, frameworks externos, Shadow DOM ou CSS fora do subconjunto reconhecido.
- Snap completo por arestas, roteamento ótimo de conexões com obstáculos, solver Android ConstraintLayout nativo, APIs externas e conteúdo complexo importado ainda são parciais.
- A reorganização é incremental: falta auditar TODOS os estados disabled, tooltips, atalhos, foco, contrastes e interfaces SVG/Sketch no desktop Linux.
- Resultado só pode ser chamado de validado quando CI **do SHA final** estiver verde; histórico de SHA anteriores não comprova novas alterações.

## Execução de testes

```bash
python -m unittest discover -s tests -v
npm run check:js
node --test tests/*.test.cjs
npm run test:ui
npm run test:studio-ui
```

Os scripts de browser usam servidor Vela real com pywebview simulado, não Android runtime nativo. O workflow `.github/workflows/ci.yml` também roda os testes Android de regressão, inclusive constraints e exportação.

**Revisão aberta e não mesclada.** Se um teste falhar, manter PR como draft e documentar o bloqueador.
