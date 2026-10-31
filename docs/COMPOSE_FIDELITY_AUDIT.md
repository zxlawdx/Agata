# Auditoria da importação visual Compose

Base: PR11 integrado em main. O pipeline existente usa Tree-sitter, IR v4, renderer DOM comum a Design/Preview e geradores independentes. As fontes originais ficam em snapshot e não devem ser regeneradas a partir de uma interpretação parcial.

Perdas verificadas antes desta correção:
- `ComposeParser.parse` promove toda declaração @Composable a Screen e ainda acrescenta setContent separadamente; inexiste grafo de chamadas/destinos.
- `literal` não conhece escopo/imports/constantes/temas, e `map_node` ignora chamadas de helpers conhecidos.
- A travessia recursiva de call_expression de Modifier visita prefixos repetidos, fora da ordem de execução. O resultado é achatado em layout.
- Material defaults/colors e Typography são tratados como argumentos desconhecidos.
- `body_calls` descarta condições de BoxWithConstraints.
- Renderer define cores, padding, tamanhos e tipografia a partir dos defaults do registro; flex children podem encolher e texto usa overflow-wrap:anywhere.
- Não há origem/resolução por propriedade no Inspector.
- Geradores usam layout achatado; exportação preserva originais, mas não edita regiões de Kotlin arbitrário.

A correção deve estender o IR opcionalmente, manter os projetos v4 existentes e conservar o mesmo editor. O ZIP Spotify foi recebido durante a implementação e está coberto diretamente pelos fixtures e testes descritos em COMPOSE_FIDELITY.md. Comparação Android/emulador exige SDK ausente neste ambiente; testes web e semânticos não serão descritos como equivalência nativa.
