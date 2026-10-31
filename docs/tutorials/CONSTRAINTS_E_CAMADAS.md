# Constraints, regiões e camadas

**Objetivo:** organizar uma tela com relações que sobrevivem ao redimensionamento.
O suporte atual é um subconjunto acíclico de ConstraintLayout, não uma reprodução completa do Android Studio.

## Conectar e centralizar

1. No projeto tutorial, selecione Abrir Login. Ele é filho direto de ConstraintLayout.
2. Ative **Constraints**. Os círculos azuis são âncoras; o quadrado de canto redimensiona.
3. Arraste Start do botão até Start do pai. Faça o mesmo com End. Os alvos devem compartilhar
   eixo: Start/End são horizontais; Top/Bottom são verticais; baseline conecta apenas TextLabels.
4. No Inspector, em **Constraints · layout**, selecione alvo, âncora e margem de cada link.
   Isso também permite editar as relações usando o teclado, sem arrastar.
5. Para remover um link, escolha Livre, clique na linha azul ou Ctrl/Cmd+clique na alça de origem.
6. Com Start e End conectados, `horizontalBias = 0.5` centraliza. `0.25` aproxima do Start;
   `0.75` aproxima do End. Use o slider ou o campo numérico. Centralizar no pai conecta os quatro lados.
7. Dimensão fixa conserva o tamanho. Wrap usa o conteúdo. Fill com lados opostos corresponde
   a Match Constraints; min/max limitam a expansão. Redimensione o Preview para comparar.
8. Se soltar um componente em ConstraintLayout, a caixa de posicionamento oferece fixar ao
   pai, centralizar, manter livre ou editar manualmente. Nenhuma nova ligação é inferida silenciosamente.

## Guidelines e barriers

1. Selecione ConstraintLayout, marque inserir como filho e insira Guideline.
2. Escolha orientation vertical/horizontal e percent entre 0 e 1 no Inspector. `0.5` é 50%.
3. Conecte uma âncora do eixo correto à guideline. A linha auxiliar não é desenhada no Preview.
4. Para uma Barrier, insira após os componentes que ela acompanhará. O editor inicia references
   com os irmãos existentes. No Inspector, `references` é uma lista de IDs de componentes de conteúdo (não helpers), separados por espaços;
   escolha direction e barrierMargin. Os IDs aparecem no Modelo JSON.
5. Não crie um ciclo. Se A depende de B, B não pode depender de A nesta versão. Chains
   recíprocas, prioridades opcionais e otimização de conflitos ainda não estão implementadas.

Baseline tem margem zero; seu Preview usa uma estimativa de métrica de fonte. Confira o
resultado nativo no Android Studio. Componentes sem uma restrição por eixo geram diagnóstico
e mantêm x/y como fallback explícito, também convertido em margens ao exportar.

## Duas laterais, barras e conteúdo

No modelo tutorial, as regiões são genéricas, sem a limitação de uma única Sidebar Material.

1. Top Bar: Region horizontal de 72 de altura, Start/End/Top no pai.
2. Bottom Bar: Region horizontal de 64, Start/End/Bottom no pai.
3. Lateral esquerda: Region de 160 de largura, Start no pai, Top na base da Top Bar e Bottom no topo da Bottom Bar.
4. Lateral direita: Region de 180 de largura, End no pai e as mesmas relações verticais.
5. Conteúdo: Region entre as barras, ligada aos dois lados do pai, Fill e maxWidth 500.
6. Flutuantes: filhos adicionais de ConstraintLayout, ligados a âncoras conforme a intenção.
7. Insira filhos em cada região e ajuste padding, dimensões e orientation. Arraste pela árvore
   para mudar parentesco. Regiões menores podem exigir scroll para conteúdo ampliado.
8. Em compact, o exemplo oculta ambas as laterais; em medium, oculta a direita. Isso não é
   conversão automática em NavigationDrawer. Edite essas regras no escopo responsivo.

**Region** exporta Row/Column ou LinearLayout. **TopBar/BottomBar/Sidebar** existentes mantêm
seus contratos Material e limitações. Para conteúdo arbitrário ou duas laterais, prefira Region.

## Layers sem perder a hierarquia

1. Selecione componentes, com Ctrl/Cmd+clique para múltiplos, e clique em **Criar camada da seleção**.
2. A camada referencia nós; não muda o parentesco. Dê duplo clique no nome para renomear.
3. Marque Visível/Bloqueada e ajuste Opacidade. Bloquear um nó de camada bloqueia sua subárvore.
4. Use ↑/↓ para mudar empilhamento entre irmãos sobrepostos; Duplicar clona os componentes
   e cria outra camada. Remover camada preserva os componentes.
5. A ordem semântica dos filhos permanece igual: camadas não redefinem a ordem de leitura.
   Z só compara irmãos no mesmo contexto; não atravessa arbitrariamente regiões distintas.

**Exercício:** sobreponha dois Cards em ConstraintLayout, coloque cada um em uma camada,
alterne a ordem e confira que os IDs e a hierarquia continuam iguais após salvar/reabrir.

| Diagnóstico | Ação |
|---|---|
| Falta restrição x/y | Conecte uma âncora, centralize ou mantenha o fallback livre conscientemente |
| Espaço menor que tamanho mínimo/fixo | Reduza tamanho/margens ou ajuste os limites e as relações |
| Ciclo | Remova a dependência recíproca; chains ainda são rejeitadas |
| Alvo inexistente | Escolha um irmão do mesmo ConstraintLayout ou o pai |
| Barrier sem alvos | Defina references ou remova a Barrier junto com os alvos |
