# Investigação das alças de ConstraintLayout

1. Em documento vazio, a raiz criada é Column. O botão apenas alternava constraintMode;
   redraw ignorava silenciosamente toda seleção sem pai direto ConstraintLayout. Nenhuma
   conversão era oferecida. Esta é uma causa reproduzível de botão ativo sem alças.
2. Alças e SVG eram filhos do contêiner. `overflow:auto/hidden` de pais/Screen corta círculos
   nas bordas e alvos fora da área rolada. Z-index alto não atravessa clipping do ancestral.
3. `.ad-constraint-anchor` tinha especificidade menor que `#android-designer button`:
   padding/border-radius gerais venciam as dimensões de círculo. Os handles eram pequenos,
   distorcidos e ainda menores com zoom reduzido.
4. Redraw dependia de seleção/render e toggle; setZoom chamava só renderWorkspace. As alças
   podiam sumir ao usar zoom, mover um frame ou scroll interno; não havia wire em movimento.
5. Pointerdown de âncora já usava capture, mas pan em bubbling não tinha prioridade universal.
6. Modelo e solver suportam anchors/bias/helpers reais. Não faltava apenas uma biblioteca:
   havia problemas de elegibilidade, affordance, overlay e ciclo de atualização.

Correção: overlay fora dos contêineres de layout, conversão explícita preservando IDs/filhos,
estilo específico, wire de arraste, hit testing por âncora e recálculo após geometria/scroll/zoom.
Teste exige 4 handles, Start/End no pai, bias, resize, save/reopen e ambos exportadores.
As mesmas verificações devem rodar com zoom reduzido e contêiner rolável. Capturas de teste
registram o estado durante o arraste, não somente um botão colorido.
