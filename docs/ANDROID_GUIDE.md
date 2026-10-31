# Usar o ambiente de interfaces Android

1. Execute o Agata normalmente: `python manage.py runapp`. Node/NPM não são necessários.
2. Crie/abra um projeto; no editor escolha **Interfaces Android**.
3. Use **Inserir exemplo de login** para criar a Tela Inicial e o Dashboard, ou crie Screens e componentes manualmente.
4. Selecione um nó pela árvore ou pelo conteúdo da Screen. Clique em um título de Card para editar o filho; duplo clique oferece edição direta de texto. O pai não precisa ser desagrupado.
5. O Inspector edita conteúdo, ícone, layout e evento. Para inserir dentro de Card/Row/Column, selecione o contêiner e marque **Inserir como filho selecionado**. Sem essa opção, a inserção ocorre na raiz da Screen.
6. Arraste o cabeçalho do frame para mover a Screen. Use scroll/botão central para pan, Ctrl+roda para zoom no cursor, Ajustar telas e Reset para centralização. A posição do frame não altera o layout Android.
7. Selecione o Button e arraste **Conectar selecionado →** até o Dashboard, ou escolha o destino no Inspector. A seta seleciona o componente de origem para editar/remover seu evento.
8. Em **Preview**, cliques executam ações em vez de selecionar nós. Campos guardam estado local; Voltar/Reiniciar controlam a pilha de navegação.
9. Salve antes de sair. Undo/redo cobre transações da sessão; não existe autosave.

## Código

Escolha **Código** ou **Dividido** e o backend Kotlin/Compose ou XML. O código gerado é somente
leitura por padrão. **Personalizar arquivo** cria uma cópia override explicitamente marcada;
suas edições ficam no projeto e são usadas na próxima exportação daquele backend.
Elas não são convertidas em componentes visuais. Alterar o Design não atualiza o conteúdo
interno dos arquivos que você personalizou.

Para sincronização reversa suportada, escolha **Modelo JSON**, edite e use **Aplicar JSON ao
Design**. Erros de schema são apresentados sem substituir o Design. **Formatar JSON** formata
esse documento; **Descartar rascunho JSON** é uma ação explícita. Copie o rascunho antes de sair
se ainda não o aplicou: ele não é parte do modelo persistido. Ctrl/Cmd+F abre a pesquisa e
substituição do CodeMirror. Erros Kotlin semânticos/compilação devem ser analisados no Android Studio.

## Exportação

**Exportar Kotlin** e **Exportar XML** salvam primeiro e geram ZIPs separados em `~/Agata/Exports`.
Os ZIPs contêm `AgataExport/`, layouts/Screen composables, MainActivity, recursos, temas,
configuração Gradle e Gradle Wrapper. O nome de namespace é configurável pelo Inspector.
No Windows, `~` corresponde à pasta do usuário, como já ocorre nos exportadores de desenho.

1. Extraia o ZIP e abra `AgataExport` no Android Studio.
2. Configure JDK 17 e Android SDK 36, e permita a sincronização normal das dependências Android.
3. No terminal do projeto: `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).
4. O primeiro uso do Wrapper/dependências requer rede. Isso não cria dependência de rede para executar o Agata.

**A compilação Android não foi executada neste ambiente.** A entrega contém fonte gerada e
validada estruturalmente/sintaticamente, não um APK verificado. Consulte a matriz de
compatibilidade em [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md) para diferenças visuais e funcionais.

Os desenhos antigos continuam em **Desenho**, com SVG/PNG/JSON. Não há conversão automática de
um desenho antigo em um aplicativo Android; a migração preserva o desenho e acrescenta o IR.

## Exemplos e reprodução

- IR: [login-dashboard.json](../examples/android/login-dashboard.json)
- Compose: [projeto fonte](../examples/android/compose)
- XML: [projeto fonte](../examples/android/xml)
- Regenerar exemplos/goldens: `python examples/android/create_example.py`
- Testes: `python -m unittest discover -s tests -v`, `node --test tests/*.test.cjs`, `npm run check:js`.
- UI antiga: `npm run test:ui`; nova UI: `npm run test:android-ui`.

Somente na máquina de desenvolvimento, para reconstruir CodeMirror: `npm ci --prefix scripts/code-editor`
e, na raiz do repositório, `node scripts/code-editor/build.cjs`. Atualize NOTICE/licenças/checksum
após mudanças nas dependências. O aplicativo usa o bundle já commitado.
