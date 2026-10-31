# Editar Kotlin/XML sem perder alterações

**Objetivo:** personalizar arquivos de cada backend e controlar a regeneração.

1. Abra Código ou Dividido; escolha Kotlin/Compose ou Android XML.
2. O seletor lista arquivos reais gerados. Abrir arquivos cria abas rápidas por nome; tooltip
   mostra o caminho completo. Compose possui Screen composables; Views possui layouts XML e Activity.
3. Escolha um arquivo Kotlin/XML da aplicação e clique em Personalizar arquivo.
4. Edite no CodeMirror local, com linhas, sintaxe, busca/substituição e histórico textual.
   Edições entram imediatamente em custom_files e marcam o projeto como alterado.
5. Salve. Mudar Design ou atualizar a geração não substitui o arquivo manual.
6. Em **Comparar / resolver arquivo**, veja gerado agora e manual lado a lado. Manter manual
   conserva o override; Regenerar este arquivo remove-o explicitamente; Cancelar não altera nada.
7. Para sincronizar conteúdo suportado de volta ao Design, use Modelo JSON e Aplicar JSON.
   O validador migra/valida antes de substituir a árvore. Kotlin arbitrário não é importado.
8. Exporte o ZIP. As modificações manuais substituem os respectivos arquivos gerados.

**Exercício:** acrescente um comentário em uma Screen Kotlin e no layout de Login XML, altere
uma cor em Design, compare, salve/reabra e confira os comentários nos dois ZIPs.

XML malformado bloqueia save/export com nome do arquivo e erro de parsing. Não há compilador
Kotlin nem SDK embutido; syntax highlighting não comprova compilação. Código personalizado
nunca é executado no editor. A comparação é textual em dois painéis; merge automático de código
manual e gerado não é prometido. Estados textuais de undo não são persistidos entre sessões.
