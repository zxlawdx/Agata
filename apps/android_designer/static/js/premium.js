/* Premium compounds remain ordinary editable Agata nodes. */
window.AgataPremiumAndroid = {
  mount({ root, model, transact, render, screen, api, message, getSelected }) {
    const library = root.querySelector(".ad-library"),
      section = document.createElement("details");
    section.innerHTML =
      '<summary>Premium Design System</summary><select aria-label="Componente premium" data-premium-component></select><button type="button" data-premium-insert>Inserir composição</button><label>Tokens JSON<textarea data-premium-tokens rows="6" aria-label="Design tokens JSON"></textarea></label><button type="button" data-premium-apply>Aplicar tokens</button><p>Composições editáveis. Player, blur e a validação por SDK ainda têm limitações descritas no projeto.</p>';
    const motion = document.createElement("select");
    motion.setAttribute("aria-label", "Motion preset");
    for (const name of ["none", "fade", "scale", "slide", "expand"])
      motion.add(new Option(name, name));
    const duration = document.createElement("input");
    duration.type = "number";
    duration.min = 0;
    duration.max = 10000;
    duration.value = 240;
    duration.setAttribute("aria-label", "Duração motion em ms");
    const applyMotion = document.createElement("button");
    applyMotion.type = "button";
    applyMotion.textContent = "Aplicar motion à seleção";
    applyMotion.onclick = () => {
      const ids = getSelected();
      if (!ids.length) {
        message("Selecione componentes para animar.", true);
        return;
      }
      transact(() => {
        for (const id of ids) {
          const node = model.find(id)?.node;
          if (!node) continue;
          if (motion.value === "none") delete node.motion;
          else
            node.motion = {
              preset: motion.value,
              duration: Math.min(
                10000,
                Math.max(0, Number(duration.value) || 0),
              ),
            };
        }
      });
    };
    const reducedLabel = document.createElement("label");
    reducedLabel.textContent = "Reduzir movimento no projeto";
    const reduced = document.createElement("input");
    reduced.type = "checkbox";
    reduced.checked = !!model.value.motionSettings?.reduced;
    reduced.onchange = () =>
      transact(() => {
        model.value.motionSettings = { reduced: reduced.checked };
      });
    reducedLabel.append(reduced);
    section.append(motion, duration, applyMotion, reducedLabel);
    library.prepend(section);
    const select = section.querySelector("select"),
      textarea = section.querySelector("textarea");
    for (const name of [
      "ModernAppBar",
      "SearchBar",
      "ProfileHeader",
      "SocialPost",
      "StoryRow",
      "MediaCard",
      "MusicPlayer",
      "MiniPlayer",
      "PlaylistCard",
      "MetricCard",
      "DashboardCard",
      "FloatingActionButton",
      "BottomNavigation",
      "NavigationRail",
      "ResponsiveNavigation",
      "SegmentedControl",
      "FilterChip",
      "BottomSheet",
      "Dialog",
      "LoadingSkeleton",
      "EmptyState",
      "ErrorState",
    ])
      select.add(new Option(name, name));
    textarea.value = JSON.stringify(
      model.value.design_system?.tokens || {},
      null,
      2,
    );
    section.querySelector("[data-premium-insert]").onclick = async () => {
      try {
        const style =
          model.value.design_system?.template.id || "material-expressive";
        const node = await api.android_premium_component(select.value, style);
        transact(() => screen().root.children.push(node));
        render();
      } catch (e) {
        message(e.message, true);
      }
    };
    section.querySelector("[data-premium-apply]").onclick = async () => {
      try {
        if (!model.value.design_system)
          throw Error(
            "Abra um dos seis templates premium para editar seus tokens vinculados.",
          );
        const value = await api.android_design_system(
          model.value,
          JSON.parse(textarea.value),
        );
        transact(() => {
          model.value = value;
        });
        render();
      } catch (e) {
        message(e.message, true);
      }
    };
  },
};
