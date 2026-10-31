# Exportando para Android

**Objetivo:** gerar e verificar um projeto fonte Android a partir do modelo editável.

1. Salve e teste as Screens no Preview, incluindo celular, tablet e fonte ampliada.
2. Clique em Exportar Kotlin ou Exportar XML. Cada backend produz um ZIP em `~/Agata/Exports`.
3. Extraia AgataExport e abra a pasta no Android Studio.
4. Configure JDK 17 e Android SDK 36. A primeira sincronização Gradle exige rede.
5. Execute `./gradlew assembleDebug`; no Windows use `gradlew.bat assembleDebug`.
6. Leia `agata-export-diagnostics.json`. A ausência de avisos não comprova compilação ou
   equivalência pixel a pixel. O exportador marca `android_build_verified: false`.
7. Confira o botão centralizado em telas diferentes e as relações Start/End em RTL.
8. Para personalizar código, use Código → Personalizar arquivo. Overrides são preservados,
   mas não voltam automaticamente à árvore visual.

| Modelo | XML | Compose |
|---|---|---|
| ConstraintLayout | androidx.constraintlayout.widget.ConstraintLayout 2.2.2 | ConstraintLayout 1.1.2 |
| Âncoras | layout_constraint… | constrainAs/linkTo |
| Bias | horizontal/vertical bias | horizontalBias/verticalBias |
| Guideline | Guideline e percentual | createGuidelineFromStart/Top |
| Barrier | Barrier e IDs referenciados | createStart/End/Top/BottomBarrier |
| Region horizontal/vertical | LinearLayout | Row/Column |
| Camada | alpha e translationZ local | graphicsLayer e zIndex local |

Linhas de edição nunca são exportadas como elementos visuais. Guidelines/barriers são helpers
nativos invisíveis; IDs e eventos são mantidos. Fallback livre sem links vira uma ligação ao pai
com a margem x/y, acompanhada de aviso. As diferenças atuais estão na
[arquitetura](../CONSTRAINTS_REGIONS_TUTORIAL_ARCHITECTURE.md).

## Exercício e diagnóstico

Exporte o mesmo projeto nos dois backends, localize os IDs do botão e da guideline e compare
as relações geradas. Compile ambos, depois teste rotação e fonte ampliada num emulador.

- SDK ausente: instale/configure o SDK no Android Studio; o Agata não gera um APK sozinho.
- Dependência não baixada: confira acesso a Google Maven/Maven Central/Gradle.
- Erro em código personalizado: remova/corrija o override do arquivo; regenerar Design não o substitui.
- Chains ou ciclos: ainda não suportados no IR, não são convertidos silenciosamente.
- Texto ou widget diverge: Preview usa métricas do navegador; valide fontes, baseline e widgets no dispositivo.

Nesta entrega não havia Android SDK no ambiente de execução. Os arquivos foram validados por
estrutura XML e parsing Kotlin; **assembleDebug e execução nativa permanecem pendentes**.
