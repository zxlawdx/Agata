"""Original semantic blocks and eight modular, runnable project templates."""

from html import escape
import json
from uuid import uuid4
from apps.design_system.services.tokens import tokens, css_tokens
from apps.template_registry.registry import get

BASE_CSS = """*{box-sizing:border-box}html{font-family:Inter,system-ui,sans-serif;color:var(--colors-textPrimary);background:var(--colors-background);line-height:1.5}body{margin:0}button,input,textarea,select{font:inherit}a{color:inherit;text-decoration:none}button,.button{cursor:pointer;border:0;border-radius:var(--shapes-md);background:var(--colors-primary);color:white;padding:.75rem 1.15rem;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:.5rem}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--colors-accent);outline-offset:3px}input,textarea,select{width:100%;border:1px solid var(--colors-border);border-radius:10px;padding:.8rem;background:var(--colors-surface);color:inherit}label{display:grid;gap:.4rem;font-size:.9rem}img,video,svg{max-width:100%;height:auto}h1,h2,h3,p{margin:0}h1{font-size:clamp(2.2rem,5vw,4.8rem);line-height:1.06;letter-spacing:-.055em}h2{font-size:clamp(1.5rem,3vw,2.3rem);line-height:1.15;letter-spacing:-.035em}small,.muted{color:var(--colors-textSecondary)}ul{padding-left:1.25rem}agata-include{display:contents}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}"""
LAYOUT_CSS = """.shell{max-width:1440px;margin:auto;padding:32px}.stack{display:flex;flex-direction:column;gap:24px}.row{display:flex;gap:16px;align-items:center}.between{justify-content:space-between}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:22px}.app-layout{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.app-main{padding:32px;min-width:0}.sidebar{padding:28px 20px;background:var(--colors-surface);border-right:1px solid var(--colors-border);display:flex;flex-direction:column;gap:24px}.sidebar nav{display:grid;gap:8px}.sidebar a{padding:12px;border-radius:10px}.sidebar a:hover{background:var(--colors-surfaceVariant)}.navbar{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 32px;border-bottom:1px solid var(--colors-border);background:var(--colors-surface)}.navbar nav{display:flex;gap:24px}.section{padding:64px 0}.hero{display:grid;grid-template-columns:1.1fr 1fr;align-items:center;gap:48px;padding:64px 0}.hero-copy{display:grid;gap:24px}.footer{padding:32px;border-top:1px solid var(--colors-border);display:flex;justify-content:space-between;gap:20px}"""
COMPONENTS_CSS = """.card{padding:24px;background:var(--colors-surface);border:1px solid var(--colors-border);border-radius:var(--shapes-lg);display:grid;gap:14px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.75rem;font-weight:750;color:var(--colors-primary)}.brand{font-size:1.3rem;font-weight:850;letter-spacing:-.045em}.metric{font-size:2.3rem;font-weight:800;letter-spacing:-.06em}.secondary{background:var(--colors-surfaceVariant);color:var(--colors-textPrimary)}.hero-art{min-height:330px;border-radius:36px;background:linear-gradient(135deg,#332958,#7863c9 55%,#dfb9c6);position:relative;overflow:hidden;display:grid;place-items:center}.hero-art svg{width:80%}.avatar{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:var(--colors-surfaceVariant);font-weight:750}.stories{display:flex;gap:18px;overflow:auto}.story{display:grid;justify-items:center;gap:8px;min-width:64px}.story .avatar{width:60px;height:60px;border:3px solid var(--colors-accent)}.media{aspect-ratio:16/10;object-fit:cover;border-radius:14px;background:var(--colors-surfaceVariant)}.form-card{max-width:460px;margin:60px auto;padding:36px}.form-card form{display:grid;gap:18px}.chip{padding:6px 12px;border-radius:999px;background:var(--colors-surfaceVariant);font-size:.8rem}.tabs{display:flex;gap:8px;flex-wrap:wrap}details{border-bottom:1px solid var(--colors-border);padding:16px 0}summary{cursor:pointer;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:14px;border-bottom:1px solid var(--colors-border)}.table-wrap{overflow:auto}.bar-chart{display:flex;align-items:end;gap:12px;height:180px}.bar-chart span{flex:1;border-radius:8px 8px 0 0;background:var(--colors-primary);min-height:10px}.price{font-size:2.5rem;font-weight:800}.glass{background:color-mix(in srgb,var(--colors-surface) 75%,transparent);backdrop-filter:blur(16px);border:1px solid #ffffff50}.toast{position:fixed;bottom:24px;right:24px;padding:16px 22px;background:var(--colors-textPrimary);color:var(--colors-surface);border-radius:12px;z-index:99}.skeleton{background:linear-gradient(90deg,var(--colors-surfaceVariant),var(--colors-surface),var(--colors-surfaceVariant));background-size:200% 100%;animation:agata-shimmer 1.4s infinite;border-radius:12px;min-height:24px}.kanban{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:18px;overflow:auto}.kanban-column{background:var(--colors-surfaceVariant);padding:16px;border-radius:16px;min-height:250px}.kanban-item{padding:16px;background:var(--colors-surface);border-radius:12px;margin:12px 0;cursor:grab}.calendar td{height:48px}.calendar .today{background:var(--colors-primary);color:white;border-radius:8px}dialog{border:1px solid var(--colors-border);border-radius:22px;padding:32px;max-width:500px;background:var(--colors-surface);color:inherit}dialog::backdrop{background:#0008}.carousel{display:flex;overflow:auto;scroll-snap-type:x mandatory;gap:20px}.carousel>*{scroll-snap-align:start;flex:0 0 80%}.notification{display:flex;justify-content:space-between;gap:16px;padding:12px 0}.mobile-menu{display:none}.cart-count{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:50%;background:var(--colors-accent);color:var(--colors-textPrimary)}@keyframes agata-shimmer{to{background-position:-200% 0}}@keyframes agata-float{50%{transform:translateY(-12px)}}.floating{animation:agata-float 4s ease-in-out infinite}"""
RESPONSIVE_CSS = """@media(max-width:1024px){.app-layout{grid-template-columns:190px minmax(0,1fr)}.shell,.app-main{padding:24px}.hero{gap:24px}}@media(max-width:767px){.app-layout{display:block}.sidebar{border:0;position:static}.sidebar nav{display:flex;overflow:auto}.navbar{padding:18px 20px;flex-wrap:wrap;gap:12px}.navbar nav{gap:14px;font-size:.9rem;order:3;width:100%;flex-wrap:wrap}.row{flex-wrap:wrap}.row>label{min-width:0}.card{min-width:0}.hero{grid-template-columns:1fr;padding:32px 0}.hero-art{min-height:260px}.shell,.app-main{padding:20px}.section{padding:36px 0}.footer{flex-direction:column}.mobile-menu{display:block}.kanban{grid-template-columns:repeat(3,240px)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}"""
ART = """<svg viewBox="0 0 500 360" role="img" aria-label="Composição geométrica original"><defs><linearGradient id="art-a" x2="1" y2="1"><stop stop-color="#e3d7ff"/><stop offset="1" stop-color="#9683e3"/></linearGradient></defs><circle cx="340" cy="120" r="100" fill="#ffffff22"/><rect x="90" y="80" width="230" height="230" rx="54" fill="url(#art-a)" transform="rotate(-12 200 180)"/><circle cx="220" cy="170" r="60" fill="#332958"/><circle cx="220" cy="170" r="16" fill="#fff"/><path d="M70 310 Q250 140 450 280" fill="none" stroke="#f6d4bd" stroke-width="18" stroke-linecap="round"/></svg>"""


def artwork():
    return ART.replace("art-a", "art-" + uuid4().hex[:12])


def card(
    title="Uma ideia com espaço para crescer",
    body="Conteúdo original, componentes semânticos e detalhes que você controla.",
):
    return f'<article class="card"><span class="eyebrow">Em destaque</span><h3>{escape(title)}</h3><p class="muted">{escape(body)}</p><a href="/pages/about.html">Saiba mais →</a></article>'


def block(name):
    if name == "navbar":
        return '<header class="navbar"><a class="brand" href="/index.html">◈ Aurora Studio</a><nav aria-label="Principal"><a href="/index.html">Início</a><a href="/pages/about.html">Sobre</a><a href="/pages/contact.html">Contato</a></nav><button data-action="toast" data-message="Vamos criar algo novo">Começar</button></header>'
    if name == "mega-menu":
        return '<nav class="navbar" aria-label="Mega menu"><a class="brand" href="/index.html">Aurora</a><details><summary>Explorar possibilidades</summary><div class="grid card"><section class="stack"><h3>Criar</h3><a href="/pages/about.html">Projetos</a><a href="/pages/contact.html">Colaboração</a></section><section class="stack"><h3>Aprender</h3><a href="/pages/about.html">Guias</a><a href="/pages/contact.html">Comunidade</a></section></div></details></nav>'
    if name == "mobile-menu":
        return '<nav aria-label="Menu móvel"><details><summary>☰ Menu</summary><div class="stack card"><a href="/index.html">Início</a><a href="/pages/about.html">Sobre</a><a href="/pages/contact.html">Contato</a></div></details></nav>'
    if name == "tabs":
        return (
            '<section data-tabs><div class="tabs" role="tablist" aria-label="Conteúdo">'
            + "".join(
                f'<button role="tab" aria-selected="{str(i==0).lower()}" tabindex="{0 if i==0 else -1}">{label}</button>'
                for i, label in enumerate(["Visão geral", "Atividade", "Detalhes"])
            )
            + "</div>"
            + "".join(
                '<section class="card" role="tabpanel"'
                + (" hidden" if i else "")
                + "><h3>"
                + label
                + "</h3><p>Conteúdo original editável desta seção.</p></section>"
                for i, label in enumerate(["Visão geral", "Atividade", "Detalhes"])
            )
            + "</section>"
        )
    if name == "timeline":
        return '<section aria-label="Linha do tempo"><ol class="stack"><li><article><time datetime="2026-01-12">12 janeiro</time><h3>Uma ideia começou</h3><p>Referências organizadas e próximos passos definidos.</p></article></li><li><article><time datetime="2026-02-05">5 fevereiro</time><h3>O projeto ganhou forma</h3><p>Conteúdo e componentes prontos para experimentar.</p></article></li></ol></section>'
    if name == "sidebar":
        return '<aside class="sidebar"><a class="brand" href="/index.html">◈ Aurora</a><small>Seu espaço de trabalho</small><nav aria-label="Seções"><a href="/index.html">Visão geral</a><a href="/pages/about.html">Projetos</a><a href="/pages/contact.html">Equipe</a></nav><div class="card"><strong>Crie com calma.</strong><small>Um bom sistema deixa espaço para novas ideias.</small></div></aside>'
    if name == "footer":
        return '<footer class="footer"><strong>◈ Aurora Studio</strong><p class="muted">Design original. Feito para ser seu.</p><a href="/pages/contact.html">Vamos conversar →</a></footer>'
    if name == "hero":
        return (
            '<section class="hero"><div class="hero-copy"><span class="eyebrow">Um novo jeito de criar</span><h1>Ideias claras.<br>Experiências memoráveis.</h1><p class="muted">Construa seu próximo projeto com elementos editáveis, código aberto à sua criatividade e espaço para experimentar.</p><div class="row"><a class="button" href="/pages/about.html">Conheça o projeto</a><a href="/pages/contact.html">Fale com a gente →</a></div></div><div class="hero-art floating">'
            + artwork()
            + "</div></section>"
        )
    if name == "card":
        return card()
    if name == "glass-card":
        return '<article class="card glass"><span class="eyebrow">Profundidade com contraste</span><h3>Uma superfície leve</h3><p>Translucidez com fundo sólido como fallback.</p></article>'
    if name == "media-card":
        return (
            '<figure class="card"><div class="hero-art">'
            + artwork()
            + '</div><figcaption><h3>Entre formas e ideias</h3><p class="muted">Artwork original e conteúdo editável.</p></figcaption></figure>'
        )
    if name == "feature-grid":
        return (
            '<section class="grid">'
            + "".join(
                card(t, b)
                for t, b in [
                    (
                        "Seu conteúdo, em primeiro lugar",
                        "Hierarquia clara e leitura confortável.",
                    ),
                    (
                        "Flexível por natureza",
                        "Layouts que se adaptam ao espaço disponível.",
                    ),
                    (
                        "Detalhes que fazem sentido",
                        "Acessibilidade e interação desde a base.",
                    ),
                ]
            )
            + "</section>"
        )
    if name == "pricing-table":
        return (
            '<section class="grid">'
            + "".join(
                f'<article class="card"><h3>{title}</h3><p class="price">R$ {price}<small>/mês</small></p><ul><li>Projetos organizados</li><li>Componentes editáveis</li><li>Exportação independente</li></ul><button data-action="toast" data-message="Plano demonstrativo; conecte seu checkout">Conhecer plano</button></article>'
                for title, price in [
                    ("Essencial", "29"),
                    ("Criativo", "59"),
                    ("Equipe", "99"),
                ]
            )
            + "</section>"
        )
    if name in {"faq", "accordion"}:
        return (
            "<section>"
            + "".join(
                "<details><summary>"
                + q
                + '</summary><p class="muted">'
                + a
                + "</p></details>"
                for q, a in [
                    (
                        "Posso editar o código?",
                        "Sim. Os arquivos HTML, CSS e JavaScript permanecem seus.",
                    ),
                    (
                        "Os layouts são responsivos?",
                        "Os templates usam Flexbox, Grid e media queries editáveis.",
                    ),
                    (
                        "Existe serviço de pagamento/autenticação?",
                        "Este é um template de interface; conecte seu backend para uso real.",
                    ),
                ]
            )
            + "</section>"
        )
    if name in {"search-bar", "input-group"}:
        return '<form class="row" data-search-form><label style="flex:1"><span class="sr-only">Pesquisar</span><input type="search" placeholder="Pesquisar conteúdo…" data-search-input></label><button>Pesquisar</button><output aria-live="polite" data-search-result></output></form>'
    if name in {"login-form", "registration-form", "contact-form"}:
        contact = name == "contact-form"
        registration = name == "registration-form"
        return (
            '<section class="card form-card"><span class="eyebrow">Bem-vindo</span><h2>'
            + ("Vamos conversar" if contact else "Seu próximo capítulo")
            + '</h2><p class="muted">'
            + (
                "Envio demonstrativo; conecte sua API."
                if contact
                else "Interface de demonstração; autenticação requer backend."
            )
            + "</p><form data-demo-form>"
            + (
                '<label>Nome<input name="name" autocomplete="name" required></label>'
                if registration
                else ""
            )
            + '<label>E-mail<input type="email" name="email" autocomplete="email" required></label>'
            + (
                '<label>Mensagem<textarea name="message" required rows="4"></textarea></label>'
                if contact
                else '<label>Senha<input type="password" name="password" minlength="6" autocomplete="'
                + ("new-password" if registration else "current-password")
                + '" required></label>'
            )
            + "<button>"
            + ("Enviar mensagem" if contact else "Continuar")
            + '</button><output aria-live="polite"></output></form></section>'
        )
    if name == "metric-card":
        return '<article class="card"><span class="muted">Projetos ativos</span><strong class="metric">24</strong><small>↗ 12% neste mês · dados demonstrativos</small></article>'
    if name == "chart-panel":
        return (
            '<article class="card"><div class="row between"><h3>Seu progresso</h3><span class="chip">Este semestre</span></div><div class="bar-chart" role="img" aria-label="Valores demonstrativos: 35, 52, 46, 78, 65, 90">'
            + "".join(
                f'<span style="height:{v}%"></span>' for v in [35, 52, 46, 78, 65, 90]
            )
            + "</div></article>"
        )
    if name == "data-table":
        return (
            '<article class="card"><h3>Últimos projetos</h3><div class="table-wrap"><table><thead><tr><th scope="col">Projeto</th><th scope="col">Status</th><th scope="col">Responsável</th></tr></thead><tbody>'
            + "".join(
                f'<tr><td>{n}</td><td><span class="chip">{s}</span></td><td>{r}</td></tr>'
                for n, s, r in [
                    ("Aurora", "Em andamento", "Lia"),
                    ("Horizonte", "Em revisão", "Caio"),
                    ("Jardim", "Concluído", "Nina"),
                ]
            )
            + "</tbody></table></div></article>"
        )
    if name in {"segmented-control", "filter-chip"}:
        return (
            '<div class="tabs" role="group" aria-label="Filtros">'
            + "".join(
                f'<button class="secondary" data-action="select" aria-pressed="{str(i==0).lower()}">{label}</button>'
                for i, label in enumerate(["Todos", "Recentes", "Favoritos"])
            )
            + "</div>"
        )
    if name in {"gallery", "carousel"}:
        return (
            '<section class="'
            + ("carousel" if name == "carousel" else "grid")
            + '">'
            + "".join(
                '<article class="card"><div class="hero-art">'
                + artwork()
                + "</div><h3>"
                + title
                + '</h3><p class="muted">Projeto original · design &amp; tecnologia</p></article>'
                for title in ["Perspectivas", "Entre linhas", "Novo horizonte"]
            )
            + "</section>"
        )
    if name == "social-post":
        return (
            '<article class="card"><div class="row"><span class="avatar" aria-label="Avatar de Lia">LA</span><div><strong>Lia Andrade</strong><p class="muted">Compartilhando processos criativos</p></div></div><p>Às vezes, a melhor ideia surge quando damos espaço para experimentar. O que você está criando hoje?</p><div class="hero-art">'
            + artwork()
            + '</div><div class="row"><button class="secondary" data-action="like" aria-pressed="false">♡ Curtir <span data-count>12</span></button><button class="secondary" data-action="toast" data-message="Ideias boas merecem conversa">Comentar</button></div></article>'
        )
    if name == "story-row":
        return (
            '<section class="stories" aria-label="Histórias">'
            + "".join(
                f'<a class="story" href="#" data-action="toast" data-message="História de {name}"><span class="avatar">{name[0]}</span><small>{name}</small></a>'
                for name in ["Você", "Lia", "Caio", "Nina", "Bia"]
            )
            + "</section>"
        )
    if name == "product-card":
        return (
            '<article class="card"><div class="hero-art">'
            + artwork()
            + '</div><span class="eyebrow">Coleção original</span><h3>Caderno Horizonte</h3><p class="muted">Papel, espaço e novas possibilidades.</p><div class="row between"><strong>R$ 48</strong><button data-action="cart">Adicionar</button></div></article>'
        )
    if name == "testimonial":
        return '<figure class="card"><blockquote>“Um sistema que deixa minhas ideias respirarem.”</blockquote><figcaption class="muted">Lia · personagem e depoimento demonstrativos</figcaption></figure>'
    if name == "breadcrumbs":
        return '<nav aria-label="Etapas"><ol class="row"><li><a href="#">Explorar</a></li><li><a href="#">Criar</a></li><li><strong>Publicar</strong></li></ol></nav>'
    if name in {"dropdown", "user-menu"}:
        return '<details class="card"><summary>Meu espaço</summary><nav class="stack"><a href="/pages/about.html">Perfil</a><a href="/pages/contact.html">Preferências</a><button data-action="toast" data-message="Ação de demonstração">Ação</button></nav></details>'
    if name == "notification-center":
        return (
            '<aside class="card"><h3>Notificações</h3>'
            + "".join(
                '<div class="notification"><p>'
                + t
                + '</p><button class="secondary" data-action="dismiss" aria-label="Dispensar notificação">×</button></div>'
                for t in ["Seu projeto foi salvo.", "Uma nova ideia chegou."]
            )
            + "</aside>"
        )
    if name == "kanban":
        return (
            '<section class="kanban">'
            + "".join(
                '<div class="kanban-column" data-drop-column><h3>'
                + t
                + '</h3><article class="kanban-item" draggable="true">'
                + v
                + "</article></div>"
                for t, v in [
                    ("Ideias", "Organizar referências"),
                    ("Em andamento", "Criar primeira página"),
                    ("Concluído", "Definir paleta"),
                ]
            )
            + "</section>"
        )
    if name == "calendar":
        return (
            '<section class="card" data-calendar><div class="row between"><button data-calendar-prev aria-label="Mês anterior">←</button><h3 data-calendar-title>Calendário</h3><button data-calendar-next aria-label="Próximo mês">→</button></div><table class="calendar"><thead><tr>'
            + "".join("<th>" + d + "</th>" for d in ["D", "S", "T", "Q", "Q", "S", "S"])
            + "</tr></thead><tbody data-calendar-days></tbody></table></section>"
        )
    if name == "file-browser":
        return '<section class="card"><h3>Arquivos selecionados</h3><label>Escolher arquivos<input type="file" multiple data-file-browser></label><ul data-file-list></ul><small>Visualização local; arquivos não são enviados automaticamente.</small></section>'
    if name == "messaging-layout":
        return '<section class="card"><h3>Conversa local demonstrativa</h3><div class="stack" data-messages><p class="chip">Vamos construir algo novo?</p></div><form class="row" data-message-form><label style="flex:1"><span class="sr-only">Mensagem</span><input name="message" required></label><button>Enviar</button></form></section>'
    if name == "tooltip":
        return '<span class="tooltip-wrap"><button aria-describedby="" data-tooltip-button>Mais informações</button><span role="tooltip">Detalhes que fazem a diferença.</span></span>'
    if name == "toast":
        return '<button data-action="toast" data-message="Tudo pronto: sua ação foi concluída.">Mostrar notificação</button>'
    if name == "modal":
        return '<section><button data-action="dialog">Abrir diálogo</button><dialog><h2>Um espaço para sua ideia</h2><p>Conteúdo editável e interação real de abrir/fechar.</p><form method="dialog"><button>Fechar</button></form></dialog></section>'
    if name == "loading-skeleton":
        return '<section class="card" aria-label="Carregando conteúdo"><div class="skeleton" style="height:160px"></div><div class="skeleton"></div><div class="skeleton" style="width:60%"></div></section>'
    if name == "gradient-background":
        return '<section class="hero-art"><h2 style="color:white">Uma nova perspectiva</h2></section>'
    if name == "decorative-blob":
        return '<div class="hero-art">' + artwork() + "</div>"
    if name == "checkbox-group":
        return '<fieldset class="card"><legend>Interesses</legend><label class="row"><input style="width:auto" type="checkbox" name="design"> Design</label><label class="row"><input style="width:auto" type="checkbox" name="code"> Desenvolvimento</label></fieldset>'
    if name == "switch":
        return '<label class="row"><input style="width:auto" type="checkbox" role="switch"> Ativar notificações</label>'
    if name == "select":
        return "<label>Frequência<select><option>Semanal</option><option>Mensal</option></select></label>"
    if name == "file-upload":
        return '<label class="card">Enviar arquivo<input type="file" data-file-browser><ul data-file-list></ul></label>'
    if name == "dashboard":
        return (
            '<section class="stack"><h2>Visão geral</h2><div class="grid">'
            + block("metric-card") * 3
            + "</div>"
            + block("chart-panel")
            + block("data-table")
            + "</section>"
        )
    if name in {"checkbox-group", "switch", "select", "file-upload"}:
        return '<fieldset class="card"><legend>Preferências</legend><label><input type="checkbox" name="updates"> Receber novidades</label><label>Formato<select><option>Semanal</option><option>Mensal</option></select></label><label>Arquivo<input type="file"></label></fieldset>'
    if name == "bottom-navigation":
        return '<nav class="row card" aria-label="Navegação inferior"><a href="/index.html">Início</a><a href="/pages/about.html">Explorar</a><a href="/pages/contact.html">Perfil</a></nav>'
    return card(name.replace("-", " ").title())


BLOCKS = {
    "Navigation": [
        "navbar",
        "sidebar",
        "breadcrumbs",
        "tabs",
        "dropdown",
        "mega-menu",
        "mobile-menu",
        "bottom-navigation",
    ],
    "Content": [
        "hero",
        "card",
        "feature-grid",
        "pricing-table",
        "testimonial",
        "faq",
        "gallery",
        "timeline",
        "accordion",
    ],
    "Forms": [
        "search-bar",
        "login-form",
        "registration-form",
        "contact-form",
        "input-group",
        "checkbox-group",
        "switch",
        "select",
        "file-upload",
    ],
    "Applications": [
        "dashboard",
        "data-table",
        "chart-panel",
        "notification-center",
        "user-menu",
        "kanban",
        "calendar",
        "file-browser",
        "messaging-layout",
    ],
    "Visual": [
        "gradient-background",
        "decorative-blob",
        "glass-card",
        "modal",
        "tooltip",
        "toast",
        "loading-skeleton",
        "carousel",
    ],
    "Social": ["story-row", "social-post", "product-card", "metric-card"],
}


def block_catalog():
    return [
        {
            "id": name,
            "name": name.replace("-", " ").title(),
            "category": category,
            "html": block(name),
            "license": "original",
        }
        for category, names in BLOCKS.items()
        for name in names
    ]


RUNTIME_JS = r"""import {mountIncludes} from './modules/components.js';
import {mountInteractions} from './modules/interactions.js';
await mountIncludes(document);
mountInteractions(document);
"""
INCLUDES_JS = r"""const projectRoot = new URL('../../', import.meta.url);
export async function mountIncludes(root) {
 const chain = new Set();
 async function include(element, depth=0) {
  if(depth>12) throw new Error('Component include depth exceeded');
  const url=new URL(element.getAttribute('src'),element.dataset.sourceBase||document.baseURI);
  if(url.origin!==projectRoot.origin||!url.href.startsWith(projectRoot.href)) throw new Error('Include outside project');
  if(chain.has(url.href)) throw new Error('Recursive component include');
  chain.add(url.href);const response=await fetch(url);if(!response.ok)throw new Error('Component not found: '+url.pathname);
  const template=document.createElement('template');template.innerHTML=await response.text();
  for(const node of template.content.querySelectorAll('[href],[src]'))for(const key of ['href','src']){const value=node.getAttribute(key);if(value&&!value.startsWith('#')&&!value.startsWith('data:'))node.setAttribute(key,value.startsWith('/')?new URL('.'+value,projectRoot).href:new URL(value,url).href);}
  element.replaceChildren(template.content);for(const nested of element.querySelectorAll('agata-include')){nested.dataset.sourceBase=url.href;await include(nested,depth+1);}chain.delete(url.href);
 }
 for(const element of root.querySelectorAll('agata-include')) if(!element.parentElement.closest('agata-include')) await include(element);
 for(const link of root.querySelectorAll('a[href^="/"]'))link.href=new URL('.'+link.getAttribute('href'),projectRoot).href;
}
"""
INTERACTIONS_JS = r"""export function mountInteractions(root){
 const toast=(text)=>{let node=root.querySelector('[data-toast-output]');if(!node){node=document.createElement('output');node.dataset.toastOutput='';node.className='toast';node.setAttribute('role','status');document.body.append(node);}node.textContent=text;node.hidden=false;clearTimeout(node.timer);node.timer=setTimeout(()=>node.hidden=true,3000);};
 root.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  if(action==='toast'){event.preventDefault();toast(button.dataset.message||'Ação concluída.');}
  if(action==='select'){button.closest('.tabs')?.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));}
  if(action==='like'){const pressed=button.getAttribute('aria-pressed')==='true';button.setAttribute('aria-pressed',String(!pressed));const count=button.querySelector('[data-count]');if(count)count.textContent=Number(count.textContent)+(pressed?-1:1);}
  if(action==='dismiss')button.closest('.notification')?.remove();
  if(action==='cart'){const count=root.querySelector('[data-cart-count]');if(count)count.textContent=Number(count.textContent)+1;toast('Adicionado ao carrinho demonstrativo.');}
  if(action==='dialog')button.parentElement.querySelector('dialog')?.showModal();
  if(action==='navigate'){event.preventDefault();location.href=new URL(button.dataset.destination||button.dataset.href,document.baseURI).href;}
  if(action==='toggle'){const target=root.querySelector(button.dataset.target);if(target){target.hidden=!target.hidden;button.setAttribute('aria-expanded',String(!target.hidden));}}
 });
 root.querySelectorAll('[data-tabs]').forEach((group,index)=>{const tabs=[...group.querySelectorAll('[role=tab]')],panels=[...group.querySelectorAll('[role=tabpanel]')],prefix='tabs-'+(group.dataset.agataId||index);const select=i=>{tabs.forEach((tab,j)=>{tab.setAttribute('aria-selected',String(i===j));tab.tabIndex=i===j?0:-1;panels[j].hidden=i!==j;});};tabs.forEach((tab,i)=>{tab.id=prefix+'-tab-'+i;tab.setAttribute('aria-controls',prefix+'-panel-'+i);panels[i].id=prefix+'-panel-'+i;panels[i].setAttribute('aria-labelledby',tab.id);tab.addEventListener('click',()=>select(i));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();select(next);tabs[next].focus();}});});});
 root.querySelectorAll('[data-demo-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())form.querySelector('output').textContent='Validação local concluída. Conecte seu backend para enviar/autenticar.';}));
 root.querySelectorAll('[data-search-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();const query=form.querySelector('input').value.toLocaleLowerCase();let count=0;root.querySelectorAll('article.card,tbody tr').forEach(node=>{const found=!query||node.textContent.toLocaleLowerCase().includes(query);node.hidden=!found;if(found)count++;});form.querySelector('output').textContent=count+' resultados';}));
 root.querySelectorAll('[data-message-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();const input=form.elements.message;if(!input.value.trim())return;const message=document.createElement('p');message.className='chip';message.textContent=input.value;form.parentElement.querySelector('[data-messages]').append(message);input.value='';}));
 root.querySelectorAll('[data-file-browser]').forEach(input=>input.addEventListener('change',()=>{const list=(input.closest('section')||input.closest('label')).querySelector('[data-file-list]');list.replaceChildren(...[...input.files].map(file=>{const item=document.createElement('li');item.textContent=file.name+' · '+file.size+' bytes';return item;}));}));
 let dragged=null;root.querySelectorAll('.kanban-item').forEach(item=>item.addEventListener('dragstart',()=>dragged=item));root.querySelectorAll('[data-drop-column]').forEach(column=>{column.addEventListener('dragover',e=>e.preventDefault());column.addEventListener('drop',e=>{e.preventDefault();if(dragged)column.append(dragged);dragged=null;});});
 root.querySelectorAll('[data-calendar]').forEach(calendar=>{let date=new Date();const draw=()=>{calendar.querySelector('[data-calendar-title]').textContent=date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});const first=new Date(date.getFullYear(),date.getMonth(),1),last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate(),body=calendar.querySelector('tbody');body.replaceChildren();let row=document.createElement('tr');for(let i=0;i<first.getDay();i++)row.append(document.createElement('td'));for(let day=1;day<=last;day++){if(row.children.length===7){body.append(row);row=document.createElement('tr');}const cell=document.createElement('td');cell.textContent=day;if(day===new Date().getDate()&&date.getMonth()===new Date().getMonth())cell.className='today';row.append(cell);}body.append(row);};calendar.querySelector('[data-calendar-prev]').onclick=()=>{date.setMonth(date.getMonth()-1);draw();};calendar.querySelector('[data-calendar-next]').onclick=()=>{date.setMonth(date.getMonth()+1);draw();};draw();});
 root.querySelectorAll('.tooltip-wrap').forEach((wrap,i)=>{const tooltip=wrap.querySelector('[role=tooltip]');tooltip.id='tooltip-'+(wrap.dataset.agataId||i);wrap.querySelector('button').setAttribute('aria-describedby',tooltip.id);});
}
"""


def document(title, body, prefix=""):
    return (
        '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
        + escape(title)
        + "</title>"
        + "".join(
            f'<link rel="stylesheet" href="{prefix}css/{name}.css">'
            for name in ["tokens", "base", "layout", "components", "responsive"]
        )
        + "</head><body>"
        + body
        + f'<script type="module" src="{prefix}js/main.js"></script></body></html>\n'
    )


def template_files(template_id):
    info = get(template_id, "web")
    title = info["name"]
    style = (
        "editorial-minimal"
        if template_id == "blog-editorial"
        else (
            "music-dark"
            if template_id == "social-web"
            else (
                "glass-blur"
                if template_id == "creative-portfolio"
                else "material-expressive"
            )
        )
    )
    design = tokens(style)
    include = (
        lambda name, prefix="": f'<agata-include src="{prefix}components/{name}.html"></agata-include>'
    )
    navbar = include("navbar")
    footer = include("footer")
    if template_id in {"saas-dashboard", "admin-panel"}:
        content = (
            '<h1 style="font-size:2.5rem">Seu espaço, em movimento.</h1><p class="muted">Dados demonstrativos para explorar seu próximo dashboard.</p>'
            + block("search-bar")
            + '<div class="grid">'
            + block("metric-card") * 3
            + '</div><div class="grid">'
            + block("chart-panel")
            + block("notification-center")
            + "</div>"
            + block("data-table")
            + (block("kanban") if template_id == "admin-panel" else "")
        )
        body = (
            '<div class="app-layout">'
            + include("sidebar")
            + '<main class="app-main stack">'
            + content
            + "</main></div>"
        )
    elif template_id == "premium-landing":
        body = (
            navbar
            + '<main class="shell stack">'
            + block("hero")
            + block("feature-grid")
            + '<section class="section stack"><h2>Um plano para cada momento.</h2>'
            + block("pricing-table")
            + "</section>"
            + block("faq")
            + "</main>"
            + footer
        )
    elif template_id == "creative-portfolio":
        body = (
            navbar
            + '<main class="shell stack">'
            + block("hero")
            + '<section class="section stack"><span class="eyebrow">Trabalhos selecionados</span><h2>Projetos com personalidade.</h2>'
            + block("gallery")
            + "</section>"
            + block("testimonial")
            + "</main>"
            + footer
        )
    elif template_id == "social-web":
        body = (
            '<div class="app-layout">'
            + include("sidebar")
            + '<main class="app-main stack"><div class="row between"><h1 style="font-size:2.5rem">Novas perspectivas.</h1><span class="avatar">LA</span></div>'
            + block("story-row")
            + block("search-bar")
            + block("social-post")
            + block("social-post")
            + "</main></div>"
        )
    elif template_id == "ecommerce":
        body = (
            navbar
            + '<main class="shell stack">'
            + block("hero")
            + '<div class="row between"><h2>Objetos para novas ideias.</h2><p>Carrinho <span class="cart-count" data-cart-count>0</span></p></div>'
            + block("search-bar")
            + '<section class="grid">'
            + block("product-card") * 6
            + "</section><small>Loja demonstrativa; conecte catálogo, estoque e checkout reais.</small></main>"
            + footer
        )
    elif template_id == "blog-editorial":
        body = (
            navbar
            + '<main class="shell stack"><header class="section stack"><span class="eyebrow">Caderno de ideias</span><h1>O tempo das<br>boas histórias.</h1><p class="muted">Leituras sobre processos, lugares e outras formas de ver.</p></header>'
            + block("tabs")
            + block("gallery")
            + block("feature-grid")
            + "</main>"
            + footer
        )
    else:
        body = (
            navbar + '<main class="shell">' + block("login-form") + "</main>" + footer
        )
    files = {
        "index.html": document(title, body),
        "pages/about.html": document(
            "Sobre · " + title,
            include("navbar", "../")
            + '<main class="shell stack section"><span class="eyebrow">Sobre nós</span><h1>Clareza para criar.</h1><p>Um projeto demonstrativo original. Edite todos os elementos e conecte seus serviços.</p>'
            + block("feature-grid")
            + "</main>"
            + include("footer", "../"),
            "../",
        ),
        "pages/contact.html": document(
            "Contato · " + title,
            include("navbar", "../")
            + '<main class="shell">'
            + block("contact-form")
            + "</main>"
            + include("footer", "../"),
            "../",
        ),
        "components/navbar.html": block("navbar"),
        "components/sidebar.html": block("sidebar"),
        "components/footer.html": block("footer"),
        "css/tokens.css": css_tokens(design),
        "css/base.css": BASE_CSS,
        "css/layout.css": LAYOUT_CSS,
        "css/components.css": COMPONENTS_CSS
        + "\n.tooltip-wrap{position:relative;display:inline-block}.tooltip-wrap [role=tooltip]{position:absolute;bottom:calc(100% + 8px);left:0;min-width:180px;max-width:260px;padding:10px;border-radius:10px;background:var(--colors-textPrimary);color:var(--colors-surface);font-size:13px;opacity:0;pointer-events:none}.tooltip-wrap:hover [role=tooltip],.tooltip-wrap:focus-within [role=tooltip]{opacity:1}\n",
        "css/responsive.css": RESPONSIVE_CSS,
        "js/main.js": RUNTIME_JS,
        "js/modules/components.js": INCLUDES_JS,
        "js/modules/interactions.js": INTERACTIONS_JS,
        "assets/images/original-art.svg": artwork(),
        "README.md": "# "
        + title
        + "\nOriginal Agata template. Run a static HTTP server, e.g. python -m http.server 8080. JavaScript modules require HTTP. Demo forms do not provide backend authentication/payments. No external dependencies or commercial assets.\n",
    }
    metadata = {
        "version": 1,
        "entry": "index.html",
        "template": {"id": template_id, "version": "1.0.0", "license": "original"},
        "tokens": design,
        "components": {
            name: {"path": "components/" + name + ".html", "name": name.title()}
            for name in ["navbar", "sidebar", "footer"]
        },
        "settings": {
            "autosave": True,
            "autosaveInterval": 30,
            "allowHttps": False,
            "reducedMotion": False,
        },
        "folders": ["assets/icons", "assets/fonts", "js/modules"],
    }
    return files, metadata
