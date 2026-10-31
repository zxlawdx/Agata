# Balde, vetores, DrawingCanvas e gráficos

**Objetivo:** modificar aparência e dados de forma persistente e exportável.

## Pintar componentes

1. Selecione um Button na árvore e escolha **Balde de tinta** em Ferramenta ativa.
2. Escolha a cor. Clique no componente selecionado: auto altera background de Button/Card/barras,
   color de TextLabel/Icon ou fill de Shape. Um filho interno não muda o alvo selecionado.
3. Canal text/icon/background/fill/stroke permite explicitar a intenção. Stroke só é suportado
   em Shape; canais incompatíveis geram mensagem, sem mudança silenciosa.
4. Ctrl/Cmd+clique seleciona vários nós; a pintura é uma transação. Undo restaura as cores.
5. Conta-gotas lê a propriedade semântica do alvo, não pixels arbitrários da área de trabalho.
   A última cor fica no perfil local; opacidade de formas e camadas fica no projeto.

## Desenhar

1. Selecione um contêiner e clique em Nova área de desenho. DrawingCanvas é um componente
   do aplicativo exportado; não é o workspace que contém as Screens.
2. Escolha retângulo, arredondado, elipse, linha, seta, triângulo, polígono ou estrela e arraste
   dentro da área. Caneta cria um segmento cúbico; Lápis registra pontos de uma linha vetorial.
3. Selecione a forma pela árvore. Edite x/y, tamanho, fill/stroke, strokeWidth, rotation,
   opacity e radius. Path é uma lista de comandos M/L/C/Q/Z com coordenadas numéricas.
4. Texto é vetorial editável. A borracha remove Shape; não apaga componentes Android arbitrários.
5. Salve/reabra, confira Preview e exporte. O Kotlin usa Canvas/Paint/PathParser; Compose
   incorpora a View vetorial por AndroidView. Não há conversão para screenshot.

## Gráficos

1. Insira Chart. Escolha kind: line, bar/column, area, pie, donut, scatter, progress, gauge,
   sparkline ou kpi. Bar/column usam atualmente colunas verticais agrupadas.
2. Edite valores em **Gráficos / Dados**. Séries, nomes, cores e labels também são estruturas
   JSON no Inspector. Scatter usa índice como x; progresso/gauge usam o primeiro valor como %.
3. Importe JSON `{ "labels": ["A"], "series": [{"name":"Série", "color":"#167CB8", "values":[10]}] }`
   ou CSV simples com cabeçalho `label,value`. CSV com aspas/vírgulas internas não é suportado.
4. Esvazie series para conferir Sem dados. Valores não finitos são rejeitados; pizza/progresso
   exigem números não negativos. O modelo limita 12 séries e 500 pontos por série.
5. Redimensione e teste fonte ampliada. Vetores e dados são recalculados no Preview;
   exportação inclui classes Kotlin Canvas com os valores atuais do projeto.

**Exercício:** pinte o botão, desenhe/rotacione uma estrela, troque 12 por 77 na tabela e
confira esses três valores no JSON após reabrir e no Kotlin exportado.

Limites: sem SVG arbitrário, editor visual de cada ponto Bézier, grupos vetoriais aninhados,
gradientes/filtros, animação/zoom interativo do gráfico ou fontes/eixos avançados. Rosca usa
centro branco. Formas dentro de DrawingCanvas não são controles individuais acessíveis nem
recebem eventos nativos próprios; configure eventos no DrawingCanvas ou em componentes Android.
