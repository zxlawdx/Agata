/* Versioned tag names are data; these original insertion recipes obey content models. */
(function (global) {
  "use strict";
  function elementHtml(name) {
    const examples = {
      ul: "<ul><li>Primeiro item</li><li>Segundo item</li></ul>",
      ol: "<ol><li>Primeiro item</li><li>Segundo item</li></ol>",
      dl: "<dl><dt>Termo</dt><dd>Descrição</dd></dl>",
      table:
        '<table><caption>Dados</caption><thead><tr><th scope="col">Título</th></tr></thead><tbody><tr><td>Conteúdo</td></tr></tbody></table>',
      thead: '<thead><tr><th scope="col">Título</th></tr></thead>',
      tbody: "<tbody><tr><td>Conteúdo</td></tr></tbody>",
      tfoot: "<tfoot><tr><td>Total</td></tr></tfoot>",
      tr: "<tr><td>Conteúdo</td></tr>",
      colgroup: "<colgroup><col></colgroup>",
      select:
        '<select aria-label="Escolha uma opção"><option value="first">Primeira opção</option><option value="second">Segunda opção</option></select>',
      optgroup: '<optgroup label="Grupo"><option>Opção</option></optgroup>',
      input: '<input type="text" aria-label="Texto" placeholder="Digite aqui">',
      textarea: '<textarea aria-label="Mensagem" rows="4"></textarea>',
      button: '<button type="button">Botão</button>',
      form: '<form><label>Nome<input name="name" required></label><button type="submit">Enviar</button><output aria-live="polite"></output></form>',
      details:
        "<details><summary>Mais detalhes</summary><p>Conteúdo expandido.</p></details>",
      dialog:
        '<dialog aria-label="Diálogo"><p>Conteúdo do diálogo</p><form method="dialog"><button>Fechar</button></form></dialog>',
      img: '<img alt="Descrição da imagem" width="320" height="180">',
      picture:
        '<picture><img alt="Descrição da imagem" width="320" height="180"></picture>',
      video:
        '<video controls aria-label="Vídeo"><p>Adicione um arquivo de vídeo.</p></video>',
      audio: '<audio controls aria-label="Áudio"></audio>',
      canvas:
        '<canvas width="320" height="180" aria-label="Área de desenho">Seu navegador precisa suportar canvas.</canvas>',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" role="img" aria-label="Forma vetorial"><circle cx="100" cy="60" r="48" fill="#6750a4"></circle></svg>',
      math: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi><mo>=</mo><mn>1</mn></math>',
      a: '<a href="#">Link</a>',
      fieldset:
        '<fieldset><legend>Preferências</legend><label><input type="checkbox"> Ativar</label></fieldset>',
      progress:
        '<progress value="50" max="100" aria-label="Progresso">50%</progress>',
      meter:
        '<meter min="0" max="100" value="60" aria-label="Nível">60%</meter>',
      search:
        '<search><form><label>Pesquisar<input type="search" name="q"></label><button>Buscar</button></form></search>',
    };
    return (
      examples[name] ||
      "<" +
        name +
        ">" +
        (global.AgataWebDomain.voids.has(name)
          ? ""
          : "Elemento " + name + "</" + name + ">")
    );
  }
  global.AgataWebCatalog = { elementHtml };
})(window);
