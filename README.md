# Agata — Estúdio criativo 🎪

**Agata** é um aplicativo desktop de desenho, esboços e design visual, desenvolvido em homenagem à esposa do autor. Seu visual *Picadeiro Pop* combina formas arredondadas, contornos escuros e uma paleta alegre. É desenvolvido em Python, [Vela Framework](https://github.com/zxlawdx/Vela-framework), HTML, CSS, JavaScript e Fabric.js.

Repositório oficial: **https://github.com/zxlawdx/Agata**

## Paleta Picadeiro Pop

| Cor | Hex |
|---|---|
| Azul picadeiro | `#53AFF2` |
| Ciano algodão-doce | `#96E6EC` |
| Rosa chiclete | `#FFCCCF` |
| Verde menta | `#B9EFC1` |
| Amarelo pipoca | `#FFE28A` |
| Lilás fantasia | `#BCACF5` |
| Creme baunilha | `#FFF9EF` |

## Funcionalidades implementadas

- Workspace com projetos recentes e criação de projetos.
- Modelos de **prancheta vazia** Android, Web, SVG e Tablet.
- Ferramentas de desenho: seleção, caneta, texto editável, retângulo, elipse, triângulo, losango, linha e borracha por objeto.
- Componentes de interface editáveis: botão, cartão, entrada de texto, top bar, sidebar e bottom bar.
- Camadas com visibilidade, bloqueio, isolamento, duplicação, ordem e renomeação.
- Árvore de objetos e edição de partes dos componentes.
- Zoom, alinhamento, grade visual, desfazer/refazer, salvamento local JSON.
- Exportação SVG/PNG/JSON em `~/Agata/Exports`.

**Interfaces Android (base inicial):** múltiplas Screens, componentes semânticos com filhos editáveis, Inspector, Preview, editor CodeMirror local e exportadores de projetos fonte XML/Kotlin Compose. Acesse pelo botão **Interfaces Android** no editor. Veja [guia](docs/ANDROID_GUIDE.md), [arquitetura e matriz de suporte](docs/ANDROID_ARCHITECTURE.md) e [auditoria/limitações](docs/AUDITORIA_EDITOR.md). Build Android e WebViews nativas ainda precisam de validação.

**Em desenvolvimento:** editor SVG avançado com curvas Bézier e pontos, eventos avançados, gerador HTML/CSS e importação de modelos completos. A seleção de formato SVG atualmente oferece ferramentas vetoriais básicas e exportação SVG.

## Executar no Linux

```bash
git clone https://github.com/zxlawdx/Agata.git
cd Agata
python3 -m venv .venv
source .venv/bin/activate
python -m pip install "vela-framework[qt6] @ git+https://github.com/zxlawdx/Vela-framework.git"
python manage.py runapp
```

Fabric.js 5.3.0 já está incluído na distribuição, com licença MIT e SHA-256 verificável. A execução não utiliza Node.js, NPM, CDN ou download inicial. Veja [execução no computador da empresa](docs/EXECUTAR.md) e [auditoria e limites](docs/AUDITORIA.md).

### Se você já tinha o Yara clonado

O GitHub foi renomeado. No diretório existente execute, **depois de preservar ou guardar suas alterações locais**:

```bash
git remote set-url origin https://github.com/zxlawdx/Agata.git
git fetch origin
git switch main
git pull --ff-only origin main
python manage.py runapp
```

Não é obrigatório renomear a pasta local `Yara`; o título da janela e os textos do programa serão **Agata**. Não use `git reset --hard` para atualizar o checkout se tiver edições próprias.

## Projetos locais e compatibilidade

Os **novos** projetos são gravados em:

```text
~/Agata/Projetos/<id>/project.json
```

Os projetos criados com a marca anterior continuam acessíveis em:

```text
~/Yara/Projetos/<id>/project.json
```

Os diretórios antigos **não são apagados, copiados ou migrados automaticamente**. A listagem combina os dois; ao salvar um projeto legado, o arquivo é atualizado na pasta original. O aplicativo mantém reconhecimento das extensões `.agata` e `.yara`.

Os arquivos exportados são armazenados em `~/Agata/Exports`.

## Arquitetura

- `apps/home`: Workspace, visual Picadeiro Pop e criação de projetos.
- `apps/workspace`: modelos, serviços e persistência JSON com suporte legado.
- `apps/sketch_editor`: Fabric.js, desenho, texto, componentes, camadas, propriedades, exportações.
- `config`: Vela, `AgataBridge` e configurações desktop.
- `tests`: regras de domínio, modelos gráficos, controles de interface e compatibilidade dos projetos.

## Testes

```bash
python -m unittest discover -s tests -v
python -m compileall -q apps config manage.py
npm run check:js
node --test tests/*.test.cjs
```

O GitHub Actions realiza os testes automatizados, mas eles não substituem a verificação manual da interface na WebView Linux e com mesa digitalizadora.
