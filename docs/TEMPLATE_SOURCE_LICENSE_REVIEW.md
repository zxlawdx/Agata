# Galeria de templates: triagem de fontes e licenças

Data da triagem: 31/10/2026. Esta tabela identifica **licenças declaradas nos repositórios**, não autoriza a cópia de todos os seus assets nem substitui auditoria de distribuição.

| Repositório | Área | Licença declarada | Uso seguro proposto no Agata | Pendências |
| --- | --- | --- | --- | --- |
| [resonate](https://github.com/kimhabkhun/resonate) | Android Compose / música | MIT, conforme README | Referência para telas originais de player/playlist e sistema de tokens | Conferir permissões de artes, capas e fontes (README menciona OFL); não copiar marcas ou conteúdo externo |
| [Now in Android](https://github.com/android/nowinandroid) | Android Compose / arquitetura | Apache-2.0 | Padrões de arquitetura modular, tema adaptativo, componentes Material 3 | Preservar avisos e verificar assets isolados antes de qualquer reuso |
| [Compose samples](https://github.com/android/compose-samples) | Android Compose | Apache-2.0 conforme repositório | Comportamento responsivo e padrões oficiais de layout | Verificar README/licença do exemplo específico |
| [SpatialFlow](https://github.com/MythicalSHUB/SpatialFlow) | Android Expressive / mídia | Apache-2.0, conforme README | Inspiração técnica para interações originais Material 3 | Conferir licenças de integração, mídias e dependências |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | Canvas Web | BSD-3-Clause | Dependência de editor já vendorizada e atribuída em NOTICE | Manter atribuições e validar build vendorizado |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Componentes Web | MIT | Referência para composição e APIs de componentes; criar blocos independentes | Código React não encaixa diretamente na arquitetura Vela sem adaptação |
| [Webstudio](https://github.com/webstudio-is/webstudio) | Visual Web IDE | AGPL-3.0-or-later (core); pacote opcional de animação é proprietário | **Referência conceitual somente**, sem copiar implementação para o Agata | Avaliação jurídica específica para qualquer reuso de código |
| [Craft.js](https://github.com/prevwong/craft.js) | Visual editor | MIT | Referência de modelo de composição e DnD | Base React; incorporar diretamente contradiz objetivo de preservar stack |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | Code editor | MIT | Editor de código já vendorizado e atribuído em NOTICE | Preservar licenças e avisos de dependências |

Fontes principais: os arquivos README e LICENSE vinculados nos repositórios acima, consultados na triagem. Em especial [resonate README](https://github.com/kimhabkhun/resonate/blob/main/README.md), [SpatialFlow README](https://github.com/MythicalSHUB/SpatialFlow), [Now in Android README](https://github.com/android/nowinandroid) e [Webstudio README](https://github.com/webstudio-is/webstudio/blob/main/README.md).

## Política de inclusão na galeria

1. Não transformar um screenshot em template: representar componentes, hierarquias, tokens, estados de interação e arquivos de origem editáveis.
2. Separar **referência** de **adaptação licenciada**: cada entrada deve registrar autor, URL, revisão do código, licença, atributos dos assets e notas de conformidade.
3. Para redistribuição, auditar código, marcas, imagens, fontes e dependências individualmente; exigir atribuições e avisos aplicáveis.
4. Preservar a identidade Agata e produzir composições originais em vez de copiar marcas de apps comerciais.
5. Nunca instalar, executar ou incorporar projetos externos sem revisão de segurança.
6. Apresentar os oito Web templates e seis estilos Android atuais como **originais Agata**, não como modelos importados dessas fontes.

**Status:** triagem documental inicial. Nenhum template externo foi importado ou redistribuído nesta revisão do PR #13. Uma galeria visual com thumbnails reais, filtros e importação legalmente revisada continua pendente.
