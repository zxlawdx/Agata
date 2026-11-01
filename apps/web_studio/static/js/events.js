/* This source is copied into the project and executes only in its isolated runtime. */
(function (global) {
  "use strict";
  const SOURCE = `const projectRoot=new URL('../../',import.meta.url);
document.addEventListener('click',event=>{const element=event.target.closest('[data-agata-event]');if(!element)return;const action=element.dataset.agataEvent,target=element.dataset.agataTarget||'';try{if(action==='navigate'){const url=new URL(target.startsWith('/')?'.'+target:target,target.startsWith('/')?projectRoot:document.baseURI);if(!['http:','https:'].includes(url.protocol))throw Error('Unsupported navigation protocol');event.preventDefault();location.href=url.href;}else if(action==='dialog'){const dialog=document.querySelector(target);if(dialog instanceof HTMLDialogElement)dialog.showModal();else throw Error('Dialog not found');}else if(action==='toggle'){const node=document.querySelector(target);if(!node)throw Error('Target not found');node.hidden=!node.hidden;element.setAttribute('aria-expanded',String(!node.hidden));}}catch(error){console.error('Agata event: '+error.message);}});
`;
  function configure(doc, id, action, target) {
    if (!["navigate", "dialog", "toggle"].includes(action))
      throw Error("Evento inválido");
    if (
      action === "navigate" &&
      !["http:", "https:"].includes(
        new URL(target, "https://agata.invalid/").protocol,
      )
    )
      throw Error("URL de navegação inválida");
    doc.transaction("Configurar evento click", () => {
      doc.attribute(id, "data-agata-event", action);
      doc.attribute(id, "data-agata-target", target);
      const module = "js/modules/agata-events.js";
      if (doc.files.has(module) && doc.text(module) !== SOURCE)
        throw Error(
          "Módulo de eventos personalizado; preserve-o e configure a ação no código.",
        );
      if (!doc.files.has(module))
        doc.edit(module, SOURCE, "Criar módulo de eventos");
      for (const [file, entry] of doc.files) {
        if (
          entry.encoding !== "utf8" ||
          !/\.html?$/i.test(file) ||
          file.startsWith("components/")
        )
          continue;
        const prefix = "../".repeat(file.split("/").length - 1);
        doc.resource(
          file,
          "data-agata-events",
          '<script data-agata-events type="module" src="' +
            prefix +
            module +
            '"></script>',
        );
      }
    });
  }
  global.AgataWebEvents = { configure, SOURCE };
})(window);
