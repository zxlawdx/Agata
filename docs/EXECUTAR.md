# Executar Agata no computador da empresa

O checkout/distribuição inclui Fabric.js 5.3.0, a licença MIT e todos os recursos visuais locais.
Não é necessário instalar Node.js, NPM, usar CDN ou baixar bibliotecas ao abrir o aplicativo.
O ambiente Python/Vela e a WebView devem estar previamente disponíveis, como no computador descrito.

1. Preserve alterações locais e obtenha a branch deste PR (ou a versão aprovada após revisão).
2. Abra o terminal na raiz do Agata e ative o ambiente Python já utilizado.
3. Execute:

```bash
python -c "from apps.sketch_editor.services.vendor import verify_vendor; verify_vendor()"
python manage.py runapp
```

O início verifica o recurso distribuído e coleta arquivos estáticos com Tailwind desativado,
sem permitir instalação. Para atualizar uma coleta antiga manualmente:

```bash
python manage.py collectstatic --no-tailwind --no-install
```

No Windows, os mesmos comandos Python funcionam com o ambiente virtual ativo. Não são
necessários comandos de administrador. Não instale dependências no computador corporativo
sem os procedimentos normais da organização; este PR não muda esses procedimentos.

Novos projetos: `~/Agata/Projetos/`. Projetos antigos: `~/Yara/Projetos/`.
Salvar um projeto antigo atualiza seu arquivo original; não ocorre movimentação automática.
Exportações: `~/Agata/Exports/`. SVG/PNG representam o desenho; JSON contém o projeto salvo.

Se aparecer recurso ausente ou alterado, restaure `apps/sketch_editor/static/vendor/` da mesma
versão do Agata e execute a coleta acima. Não é necessário executar `npm run vendor`.

## Desenvolvimento e verificações

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m unittest tests.verify_static_paths -v
node --test tests/*.test.cjs
npm run check:js
```

Apenas para testes de navegador em uma máquina de desenvolvimento/CI:

```bash
npm install --ignore-scripts
npx playwright install chromium
npm run test:ui
```

O teste sobe um servidor Vela em loopback, renderiza templates reais, usa serviços Python
reais em diretório temporário e substitui o transporte pywebview por HTTP de teste.
Bloqueia pedidos do navegador para hosts externos. Não lê nem altera projetos pessoais.
`AGATA_EVIDENCE=docs/evidence npm run test:ui` registra imagens com dados fictícios.
A comparação nativa final ainda deve ser feita no Windows e Linux, inclusive com escala
do sistema e mesa digitalizadora: criar, desenhar, redimensionar, salvar, reabrir e exportar.
