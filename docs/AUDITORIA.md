# Auditoria e correções — Agata

Base auditada: `a1b4e45ce653194641951508fe86e2be7de30521` (main).

## Causas confirmadas

| Prioridade | Problema | Causa e correção |
|---|---|---|
| P0 | Home rosa vazia | `agata.js:navigate()` acessava `#agata-projects`, ausente em `home.html`. A exceção ocorria antes de `refresh()`. ID corrigido; estados de carregamento, vazio, erro/repetição e lista implementados. |
| P0 | Editor sem Fabric | `.gitignore` excluía o recurso exigido pelo loader. Distribuição oficial 5.3.0 incluída, com licença e verificação SHA-256 no início. Nenhum download na execução. |
| P1 | Overflow da home | Raiz content-box com largura 100% + padding; shell limitada a 1430px e altura mínima calculada em viewport. Raiz border-box e altura herdada do Vela; shell ocupa área útil; main e navegação rolam internamente. |
| P1 | Workspace sempre ativo | Seleção atualizava apenas data-section. Estado único de seção + modo transitório do modal agora sincroniza todos os itens; cancelar/fechar/Esc restaura a seção real. |
| P1 | Mascote tipográfico | Glifo `☺` substituído por SVG original local, com contorno orgânico, olhos e sorriso. Comparado ao mockup `image(20261031-035511).png`; sem dependência de fonte/licença externa. |
| P1 | Editor estreito | Colunas fixas consumiam a área central. Painéis de ferramentas/inspetor recolhíveis abaixo de 720px, controles com aria-expanded; toolbar e navegação rolam horizontalmente. |

O shell do Vela usa `.vela-shell__app-root` e `#vela-page`. As duas rotas continuam
`layout="blank"`. O app declara seu modelo de rolagem; não aplica um reset global para
esconder largura excedente. A altura do editor também passa a herdar a região hospedeira.
A home escuta `pywebviewready` e permite repetir a listagem caso o transporte esteja indisponível.

## Referências efetivamente inspecionadas

| Repositório | Arquivos e contribuição |
|---|---|
| DFD-Studio | `apps/dfd/templates/dfd/index.html`, `static/css/app.css`, `views/workspace.py`: barras fixas na composição flex e scroll interno. Não foi copiada sua altura mínima de 570px. |
| acess_manager | `apps/zte_manager/static/css/components/shell_layout.css`, `layout/editorial_workspace.css`: min-width/min-height, organização por regiões e adaptação à largura real; não foi copiada sua camada extensa de !important. |
| acess_manager2 | `apps/access_manager/static/css/vela-integration.css`, `static/js/bootstrap.js`: escopo de estilos e montagem protegida contra duplicação. |
| Vela-Forge | `apps/forge/views/forge.py`, `templates/forge.html`, `static/css/editor.css`: composição com render_template/mark_safe e Grid; aplicada incrementalmente à sidebar e modal da home. |
| Vela-framework | `vela/core/shell.html`, `router.py`, `vela/cli/collectstatic.py`, `asset_pipeline.py`, `vela/static.py`: ciclo pywebviewready, rotas blank, URLs HTTP e coleta sem Node/Tailwind. Nenhuma modificação no framework ou nos outros repositórios. |

## Distribuição e integridade

O pacote oficial `fabric-5.3.0.tgz` contém a distribuição que informa `fabric.version=5.3.0`.
O dist do tag GitHub e do cdnjs inspecionados informam 5.1.0, por isso não foram usados.
Origem, licença e SHA-256 estão em `apps/sketch_editor/static/vendor/README.md`.
`services/vendor.py` rejeita ausência/alteração; `asset_revision()` já inclui Fabric no cache hash.
`ASSETS={"tailwind":false}` e a coleta no início não declaram scripts NPM.
O script opcional `npm run vendor` agora somente verifica o recurso distribuído.

## Auditoria de controles e evidências

| Grupo | Responsável | Verificação realizada |
|---|---|---|
| Criar/listar/abrir; templates e sidebar | home/agata.js → AgataBridge → ProjectService | Navegador com Python real: modal, cancelar, Esc, todos os itens, preset, erro/repetição, carregamento, criar e reabrir. |
| Seleção de ferramentas, formas e caneta | sketch_editor/js/editor.js → Fabric | Desenho real no navegador para retângulo, elipse, triângulo, losango, linha e traço; objetos serializados verificados. |
| Partes de componentes | components.js / component_edit.js / editor.js | Inserção de botão, editar partes, adicionar ícone e concluir no navegador; testes de modelo para vínculos e hierarquia. |
| Camadas | sketch_core.js / editor.js | Adicionar e bloquear/desbloquear no navegador; testes de modelo para duplicar, ordenar, ocultar e preservar camada ativa. |
| Histórico, zoom, grade e salvar | editor.js → SketchService | Desfazer/refazer, zoom, ajustar, grade, salvar/reabrir exercitados no navegador. |
| Exportações | editor.js → ArtworkExporter | Botões SVG/PNG/JSON exercitados; XML interpretado, PNG 512×512 confirmado, arquivos temporários gravados. Testes Python de validação e formatos também passam. |
| Propriedades, alinhar, ordem, duplicar/excluir, texto e borracha | editor.js / element_tree.js | Implementação e ligações auditadas; testes unitários de alinhamento/ordem. Não houve cobertura completa de cada interação destes controles no navegador. |
| Painéis estreitos | editor.js / picadeiro.css | Abrir, alternar e recolher painéis no navegador a 390px; captura inspecionada. |
| Visualização XML/HTML/CSS | editor.html | Estrutura de painel com indisponibilidade explícita; nenhuma geração fictícia. |
| Fluxo de App | sidebar.html | Desabilitado com indicação “em breve”. |

## Verificações executadas

- 27 testes Python: domínio, compatibilidade, persistência, exportações, integridade e coleta Vela.
- Teste adicional de referências static() dos templates, incluindo os parciais.
- 20 testes JavaScript existentes e verificação de sintaxe.
- Teste de coleta com PATH vazio, execução de ferramentas externas e conexões de rede proibidas.
- Chromium headless: templates Vela e HTTP de recursos reais, transporte de teste e serviços Python isolados.
- Home: 1920×1080, 1440×900, 1024×768, 640×480 e 390×700 sem overflow global.
- Editor: 1440×900, 1024×768, 640×480 e painéis a 390×700.
- Capturas em `docs/evidence/` inspecionadas visualmente. `workspace-before.png` é a captura adicional fornecida, mostrando o defeito original.

## Limites e próximas etapas

Não foi executada WebView nativa Windows/Linux nem mesa digitalizadora física. O teste de
navegador substitui apenas o transporte da Bridge e a navegação; não demonstra o ciclo
nativo completo. A caneta atual usa PencilBrush com largura fixa: pressão/inclinação não
foram implementadas nem medidas. Coordenadas usam canvas.getPointer com escala CSS e
limites da prancheta; a suíte desenhou em zoom ajustado, sem cobrir todas as escalas/DPI.

Os geradores Android XML/HTML/CSS, edição Bézier, importação completa de modelos e Fluxo
de App continuam pendentes. Esta entrega corrige os bloqueios e preserva o editor básico;
não afirma concluir o editor avançado. Não há alteração destrutiva ou migração automática
dos projetos Yara, nem merge automático.
