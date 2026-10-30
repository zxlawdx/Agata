# Yara — visual workspace

Yara é uma aplicação desktop para criação visual, construída com [Vela Framework](https://github.com/zxlawdx/Vela-framework) (Python + WebView + HTML/CSS/JavaScript).

## Primeira etapa: home e projetos

- Tela inicial no estilo de aplicativo criativo, com Novo projeto e Projetos recentes.
- Painel lateral com Início e Projetos.
- Cards para Esboço, Interface e SVG. Interface e SVG estão sinalizados como Em breve.
- Formulário de criação de projeto de esboço com nome, plataforma e resolução.
- Leitura, listagem e criação de projetos locais por Bridge Python/JavaScript.
- Identidade visual do Lunacy: #1A1C1C, #0097A7, #B2EBF2, branco e tipografia Inter com fallback do sistema.
- Arquitetura separada: views, services, repositories e contrato de persistência.

O editor real de esboços ainda não faz parte desta etapa. Ao abrir um projeto, a home mostra seus detalhes. A manipulação em Canvas e a edição com mesa digitalizadora serão desenvolvidas na próxima entrega.

## Executar em Linux

Clone o repositório e use a branch feat/home-workspace:

    git clone https://github.com/zxlawdx/Yara.git
    cd Yara
    git switch feat/home-workspace

Instale o Vela com backend gráfico conforme a documentação do próprio framework. Para um ambiente virtual Linux usando Qt6:

    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install "vela-framework[qt6] @ git+https://github.com/zxlawdx/Vela-framework.git"
    python manage.py collectstatic --no-tailwind --no-install
    python manage.py runapp

O sistema pode exigir bibliotecas Qt6 específicas, conforme a distribuição Linux. Uma instalação sem extras GUI não é suficiente para abrir a WebView.

## Testes

    python -m unittest discover -s tests -v
    python -m compileall -q apps config manage.py
    node --check apps/home/static/yara.js

O workflow do GitHub Actions executa esses testes. A validação visual nativa do Linux ainda precisa ser feita no computador do desenvolvedor.

## Dados locais

Os projetos ficam em:

    ~/Yara/Projetos/<id>/project.json

O identificador de pasta é um UUID aleatório validado no backend. O nome fornecido pelo usuário não é usado diretamente no caminho. Os arquivos são salvos com substituição atômica no mesmo diretório.

## Módulos

- config/ — VelaApp, configurações e YaraBridge.
- apps/home/ — view e interface da tela inicial.
- apps/workspace/services/ — regras de validação e criação.
- apps/workspace/repositories/ — interface abstrata e persistência JSON.
- tests/ — testes de serviços sem dependência de interface gráfica.

## Próximas entregas

1. Prancheta de esboços com Fabric.js e dimensões de dispositivo.
2. Ferramentas de desenho livres, formas, mesa digitalizadora e persistência de objetos.
3. Bibliotecas de componentes e paletas.
4. Editor SVG e editor de interfaces com exportadores separados.

Este repositório consome o Vela como dependência sem alterar o código-fonte do framework.


## Etapa 2 — Editor de esboços (branch `feat/sketch-editor`)

A home abre o editor após criar um projeto; clicar num projeto existente também o abre.
O editor oferece ferramentas de seleção, caneta para mouse/mesa digitalizadora,
borracha por objeto, texto editável, retângulo, elipse, linha, componentes de interface,
zoom, desfazer/refazer, propriedades e camadas com visibilidade, bloqueio, isolamento,
duplicação e reordenação. As posições são expressas nas dimensões lógicas da prancheta.

**Preparação obrigatória do motor local de desenho** (uma vez por checkout):

```bash
npm install --ignore-scripts
npm run vendor
python manage.py runapp
```

O Fabric.js 5.3.0 é usado como dependência de build. O arquivo distribuído fica em
`apps/sketch_editor/static/vendor/fabric.js` (não versionado); depois de preparado
o Yara funciona sem internet. Sem esse arquivo, o editor mostra um erro explícito.

Use a camada selecionada para inserir elementos, o cadeado para travar e o olho
para ocultar. O ícone de alvo isola visualmente uma camada. A borracha apaga objetos
inteiros, não pixels individuais. A escrita à mão funciona como traços de caneta;
sensibilidade à pressão real ainda precisa ser verificada com a mesa digitalizadora no Linux.

**Salvar** ou Ctrl+S grava em `~/Yara/Projetos/<id>/project.json`. A edição
ainda é por uma tela por projeto. XML, HTML e ferramentas vetoriais avançadas
não fazem parte desta etapa.

Validação: `python -m unittest discover -s tests -v`,
`node --test tests/sketch_core.test.cjs`, `npm run check:js` e testes
manuais na WebView Qt6 e com a caneta física.
