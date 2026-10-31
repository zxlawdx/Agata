# Auditoria inicial — Project Manager e importação

Base: main após PR #10 (`fb53a5c`). Vela/pywebview em config/bridge.py; persistência em
JsonProjectRepository (`~/Agata/Projetos/<id>/project.json`, legado Yara preservado).
ProjectService cria/lista projetos; home/agata.js possui modal de templates, mas não importador,
registro de locais externos nem explorer de fontes originais. IR v4 é independente de Fabric.
InterfaceService valida/salva com controle de revisão. Document.transact e históricos Fabric/
CodeMirror já possuem regressões granulares; devem ser reutilizados.

Exporters geram fonte completa, Gradle/Manifest/Wrapper e custom_files; não executam builds.
Não há parser reverso de Kotlin nem preservação de um projeto Gradle arbitrário no modelo.
O arquivo agata-model.json dos ZIPs oferece restauração prioritária e exata da árvore.
Tree-sitter/Kotlin já é usado nos testes sintáticos; passa a ser dependência do importador AST.

Decisões: snapshot isolado e imutável da entrada, staging cancelável, paths validados, preview
antes do registro, AST sem execução, recursos resolvidos localmente, classificação real e
exportação sem substituir silenciosamente Activity ou Gradle. Projetos sem UI são válidos
quando a estrutura Android é reconhecível; pasta vazia requer inicialização explícita.
