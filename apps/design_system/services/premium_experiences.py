"""Three original multi-screen Android experiences made of editable Agata IR nodes.

No music playback, social backend or payment execution is asserted: interactions are
locally demonstrative. Compose/XML exporters consume the same primitives and IDs.
"""
from __future__ import annotations
from apps.android_designer.domain.model import new_document,new_screen,new_node
from .tokens import tokens

CONFIG={
 "music-dark":{
  "app":"Sonora","screens":["Home","Search","Library","Playlist Detail","Now Playing","Artist Profile"],
  "intro":"Descubra o som que combina com seu momento",
  "nav":[("Início",0),("Buscar",1),("Biblioteca",2),("Tocando",4)]},
 "social-modern":{
  "app":"Mosaic","screens":["Feed","Explore","Profile","Post Detail","Messages","Notifications"],
  "intro":"Histórias para compartilhar, ideias para descobrir",
  "nav":[("Feed",0),("Explorar",1),("Perfil",2),("Mensagens",4)]},
 "fintech-premium":{
  "app":"Nexa Finance","screens":["Dashboard","Transactions","Cards","Analytics","Transfer","Profile"],
  "intro":"Sua visão financeira, com mais clareza",
  "nav":[("Início",0),("Extrato",1),("Cartões",2),("Análises",3)]},
}

def build(key):
    if key not in CONFIG:raise ValueError("Experiência Android não encontrada.")
    from .android import component,bind,resolve_tokens,COMPONENTS
    from apps.template_registry.registry import get
    spec=CONFIG[key];scheme=tokens(key);colors=scheme["colors"]
    d=new_document()
    d["app_name"]=spec["app"]
    d["namespace"]={"music-dark":"com.agata.sonora","social-modern":"com.agata.mosaic",
                     "fintech-premium":"com.agata.nexa"}[key]
    d["theme"].update(primary=colors["primary"],darkMode="dark" if key!="social-modern" else "light",dynamicColor=False)
    d["screens"]=[new_screen(name,80+(i%3)*490,80+(i//3)*1000) for i,name in enumerate(spec["screens"])]
    d["start_screen"]=d["screens"][0]["id"]
    d["design_system"]={
      "version":1,"template":get(key,"android"),"tokens":scheme,"components":COMPONENTS,
      "motion":{"reduced":False},
      "limitations":[
        "Native Android SDK build and pixel-accurate Material 3 rendering not verified here.",
        "Illustrations are editable vector placeholders, not licensed album covers or stock photography.",
        "Media play/pause, follow/reaction, and money transfer are local demos; no audio engine, social server or banking service.",
      ],
    }
    def node(kind,props=None):
        return new_node(kind,props)
    def text(value,size=16,role=None):
        n=node("TextLabel",{"text":value,"fontSize":size})
        bind(n,"props","color","colors.textPrimary",colors["textPrimary"])
        n["role"]=role or ("title" if size>=22 else "body")
        return n
    def col(children=None,gap=12,padding=0):
        n=node("Column")
        n["layout"].update(width="fill",height="wrap",gap=gap,padding=padding)
        n["children"]=list(children or [])
        return n
    def row(children,gap=10):
        n=node("Row")
        n["layout"].update(width="fill",height="wrap",gap=gap,wrap=True)
        n["children"]=children
        return n
    def card(title="",body="",children=None,color="surface"):
        n=node("Card")
        n["layout"].update(width="fill",height="wrap",gap=10,padding=16)
        bind(n,"props","background","colors."+color,colors[color])
        n["children"]=[text(title,20,"heading")] if title else []
        if body:n["children"].append(text(body,13,"description"))
        n["children"]+=list(children or [])
        n["name"]="Card · "+(title[:65] if title else "Conteúdo")
        return n
    def art(name, accent="accent", height=135):
        """Original editable vector illustrations, never screenshots/third-party art.

        The three visual languages intentionally differ:
        Sonora = concentric sound & tempo;
        Mosaic = editorial illustrated landscape;
        Nexa = geometric financial card.
        """
        canvas = node("DrawingCanvas", {
            "background": colors["surfaceVariant"],
            "viewportWidth": 400, "viewportHeight": height
        })
        canvas["layout"].update(width="fill", height=height)
        canvas["name"] = "Arte original em vetor · " + name

        def shape(kind,x,y,width,h,fill,opacity=1,radius=20,rotation=0):
            s=node("Shape",{"kind":kind,"fill":fill,"stroke":fill,
                             "strokeWidth":0,"radius":radius,
                             "opacity":opacity,"rotation":rotation})
            s["layout"].update(x=x,y=y,width=width,height=h)
            s["name"]="Forma editável · "+name+" · "+kind
            return s

        def curve(x,y,width,h,fill,commands,opacity=1):
            s=shape("path",x,y,width,h,fill,opacity)
            s["props"]["path"]=commands
            return s

        primary=colors[accent]
        contrast=colors["primary"] if accent!="primary" else colors["accent"]
        secondary=colors["secondary"]
        surface=colors["surface"]
        seed=sum(ord(ch) for ch in name)%37
        layers=[shape("roundedRect",8,8,384,height-16,primary,radius=26)]

        if key=="music-dark":
            # Offset vinyl/sonic rings and an original traversing wave, no album artwork.
            layers.extend([
                shape("ellipse",175,6,160,160,contrast,.85),
                shape("ellipse",197,23,119,119,colors["background"],.84),
                shape("ellipse",218,40,78,78,secondary,.90),
                shape("ellipse",239,57,37,37,surface,.88),
                curve(25,max(12,height*.4),352,max(48,height*.40),surface,
                      [["M",0,38],["C",68,0,124,72,192,34],
                       ["C",264,0,310,55,352,8]],.87),
                shape("ellipse",36+seed,max(12,height*.18),18,18,surface,.90),
                shape("ellipse",98+seed,max(18,height*.68),10,10,surface,.75),
                shape("roundedRect",30,max(16,height*.75),115,7,contrast,.85,radius=5),
            ])
        elif key=="social-modern":
            # Editorial landscapes with original geometry and changing composition.
            layers.extend([
                shape("ellipse",260-seed,15,95,95,secondary,.94),
                curve(8,max(25,height*.32),375,max(72,height*.62),contrast,
                      [["M",0,65],["C",70,8,130,22,180,42],
                       ["C",260,92,310,4,375,35],["L",375,115],["L",0,115],["Z"]],.94),
                curve(8,max(30,height*.50),375,max(48,height*.45),colors["background"],
                      [["M",0,65],["C",80,5,120,60,200,28],
                       ["C",280,2,330,80,375,38],["L",375,100],["L",0,100],["Z"]],.74),
                shape("roundedRect",42+seed,max(20,height*.32),31,66,surface,.85,radius=7),
                shape("roundedRect",85+seed,max(22,height*.39),28,48,surface,.80,radius=7),
                shape("ellipse",154+seed,max(14,height*.23),16,16,surface,.90),
            ])
        else:
            # Refined anonymous credit-card geometry; no bank/trademark or real credentials.
            layers.extend([
                shape("ellipse",234,5,166,166,contrast,.76),
                shape("ellipse",282,28,116,116,surface,.24),
                curve(10,max(14,height*.38),365,max(50,height*.55),secondary,
                      [["M",0,70],["C",95,5,150,90,234,36],
                       ["C",280,3,333,14,365,1],["L",365,110],["L",0,110],["Z"]],.44),
                shape("roundedRect",33,max(18,height*.28),54,36,surface,.88,radius=8),
                shape("roundedRect",41,max(20,height*.29),38,29,contrast,.64,radius=7),
                shape("roundedRect",36,max(28,height*.70),126,13,surface,.88,radius=6),
                shape("roundedRect",36,max(42,height*.82),73,8,surface,.64,radius=5),
                shape("ellipse",307,max(22,height*.72),31,31,surface,.66),
                shape("ellipse",326,max(22,height*.72),31,31,contrast,.70),
            ])
        canvas["children"]=layers
        return canvas

    def button(label,target=None):
        n=node("Button")
        n["children"][-1]["props"]["text"]=label
        n["name"]="Ação · "+label
        bind(n,"props","background","colors.primary",colors["primary"])
        n["events"]={"onClick":{"action":"navigate" if target else "custom",
                                "target":target or "DemonstracaoLocal"}}
        return n
    def link(label,index):
        return button(label,d["screens"][index]["id"])
    def block(name,props=None,target=None):
        return component(name,scheme,props or {},target)
    def navigation(active,rail=False):
        n=node("NavigationRail" if rail else "BottomBar")
        n["name"]="Navegação responsiva"
        n["layout"].update(width=220 if rail else "fill",height="fill" if rail else "wrap",gap=4,padding=6)
        n["children"]=[]
        bind(n,"props","background","colors.surface",colors["surface"])
        icons={"Início":"home","Buscar":"search","Biblioteca":"menu","Tocando":"settings",
               "Feed":"home","Explorar":"search","Perfil":"settings","Mensagens":"menu",
               "Extrato":"menu","Cartões":"menu","Análises":"search"}
        for label,index in spec["nav"]:
            item=node("NavigationItem")
            item["children"][0]["props"]["icon"]=icons.get(label,"menu")
            bind(item["children"][0],"props","color","colors.textPrimary",colors["textPrimary"])
            bind(item["children"][1],"props","color","colors.textPrimary",colors["textPrimary"])
            item["children"][-1]["props"]["text"]=label
            item["props"]["selected"]=index==active
            item["events"]={"onClick":{"action":"navigate","target":d["screens"][index]["id"]}}
            item["name"]="Ir para "+spec["screens"][index]
            n["children"].append(item)
        if rail:
            n["layout"].update(visible=False)
            n["layout"]["responsive"]={k:{"visible":True,"width":220 if k!="medium" else 80}
                                       for k in ["medium","expanded","large","extraLarge"]}
        else:n["layout"]["responsive"]={k:{"visible":False}
                                          for k in ["medium","expanded","large","extraLarge"]}
        return n
    def sections(index):
        s=spec["screens"];prefix=[]
        if key=="music-dark":
            if index==0:
                return [text("Boa noite, criador ✦",30),text(spec["intro"],14),
                  card("Em destaque · Aurora Boreal","Playlist curada para novas descobertas.",
                       [art("Aurora",height=170),link("Explorar playlist",3)]),
                  text("Continue ouvindo",22),
                  row([block("PlaylistCard",{"title":"Horizontes em azul"},d["screens"][3]["id"]),
                       block("PlaylistCard",{"title":"Café e chuva"},d["screens"][3]["id"])]),
                  block("MiniPlayer"),link("Abrir player",4)]
            if index==1:
                return [text("O que você quer ouvir?",30),block("SearchBar"),
                    row([block("FilterChip"),link("Artistas",5),link("Playlists",3)]),
                    card("Descubra novos sons","Eletrônica · Jazz · Instrumental",[art("Categorias sonoras","primary",145)]),
                    link("Conhecer artista em destaque",5)]
            if index==2:
                return [text("Sua biblioteca",30),text("Álbuns, artistas e playlists demonstrativos.",14),
                   block("SegmentedControl"),
                   block("PlaylistCard",{"title":"Caderno de viagens"},d["screens"][3]["id"]),
                   block("PlaylistCard",{"title":"Noite em movimento"},d["screens"][3]["id"]),
                   link("Agora tocando",4)]
            if index==3:
                return [art("Capa original da playlist","primary",220),
                   text("Horizontes em azul",30),text("Sonora Originals · 24 faixas demonstrativas",14),
                   row([link("▶ Ouvir demonstrativo",4),link("Ver artista",5)]),
                   card("Lista de faixas",children=[
                      text("01 · Caminhos de luz · 3:42",16),
                      text("02 · Cidade de vidro · 4:08",16),
                      text("03 · Primavera elétrica · 2:57",16)])]
            if index==4:
                return [art("Capa vetorial do player",height=235),
                  text("Caminhos de luz",30),text("Estúdio Horizonte · Sonora",14),
                  node("Slider"),row([link("Faixa anterior",3),link("Próxima faixa",3)]),
                  card("Estado de reprodução · demonstração",
                       "A chave alterna somente o estado visual; não existe engine de áudio.",
                       [row([text("Play / Pause (demo)",16),node("Switch")])]),
                  link("Ver perfil do artista",5)]
            return [art("Artista original","accent",180),block("ProfileHeader",{"title":"Estúdio Horizonte"}),
                    text("Músicas para imaginar outros mundos.",14),
                    row([link("Playlists",3),link("Ouvir demonstração",4)]),
                    block("PlaylistCard",{"title":"Seleção do artista"},d["screens"][3]["id"])]
        if key=="social-modern":
            if index==0:return [text("Hoje no Mosaic",30),text(spec["intro"],14),
                block("StoryRow"),
                block("SocialPost",{"title":"Um novo olhar pela cidade"},d["screens"][3]["id"]),
                block("SocialPost",{"title":"Pequenos momentos, grandes histórias"},d["screens"][3]["id"]),
                link("Notificações",5)]
            if index==1:return [text("Explorar",30),block("SearchBar",{"placeholder":"Pessoas, lugares e ideias"}),
                  row([art("Fotografia abstrata 1",height=150),art("Fotografia abstrata 2","primary",150)]),
                  block("MediaCard",{"title":"Inspirações em destaque"},d["screens"][3]["id"]),
                  link("Ver perfil da comunidade",2)]
            if index==2:return [block("ProfileHeader",{"title":"Maya Andrade"}),
                 card("128 publicações · 3,2 mil seguidores","Perfil demonstrativo original.",
                      [row([button("Seguir (demo)"),link("Mensagem",4)])]),
                 text("Galeria pessoal",22),art("Coleção vetorial Mosaic",height=200),
                 link("Abrir publicação",3)]
            if index==3:return [block("MediaCard",{"title":"Encontro de formas"},d["screens"][2]["id"]),
                  text("O que faz uma boa ideia ganhar vida?",16),
                  card("Curtir (demo)", "Interações locais, sem publicação em servidor.",
                     [row([text("Gostei",16),node("Switch")])]),
                  text("Comentários",22),
                  card("Luna · Adorei as cores!"),card("Noah · Inspiração de hoje."),
                  link("Visitar criador",2)]
            if index==4:return [text("Mensagens",30),block("SearchBar",{"placeholder":"Buscar conversas"}),
                 card("Luna","Você viu as novidades?",[link("Abrir conversa (demo)",4)]),
                 card("Noah","Vamos criar algo juntos?",[link("Ver perfil",2)]),
                 text("Mensagens são demonstrativas; não há servidor.",13)]
            return [text("Notificações",30),card("Nova interação","Luna curtiu sua publicação."),
                  card("Novos seguidores","Pessoas descobriram seu perfil."),
                  card("Lembrete","Compartilhe uma nova ideia!"),
                  link("Ver seu perfil",2)]
        if index==0:return [text("Seu dinheiro com clareza ✦",30),text(spec["intro"],14),
             block("MetricCard",{"title":"Saldo total","value":"R$ 12.480,00"}),
             row([link("Transferir (demo)",4),link("Ver extrato",1)]),
             block("DashboardCard",{"title":"Resumo do mês","value":"R$ 3.860,00"}),
             card("Atividades recentes","Hoje · Mercado -R$ 124,50\nOntem · Salário +R$ 5.200,00")]
        if index==1:return [text("Movimentações",30),block("SearchBar",{"placeholder":"Buscar transações"}),
                 block("SegmentedControl"),
                 card("Hoje",children=[text("Mercado de bairro   -R$ 124,50"),
                                       text("Café do centro   -R$ 18,90")]),
                 card("Ontem",children=[text("Crédito de salário   +R$ 5.200,00"),
                                        text("Assinatura anual   -R$ 89,00")]),
                 link("Analisar despesas",3)]
        if index==2:return [text("Meus cartões",30),card("Nexa · Cartão virtual",children=[
                     art("Cartão ilustrativo original","primary",165),
                     text("•••• 2048 · Visa não vinculada",14)]),
                  card("Fatura demonstrativa","Vencimento dia 15 · R$ 1.264,80"),
                  link("Ver despesas do cartão",1)]
        if index==3:return [text("Análise financeira",30),card("Receitas e despesas",
                    "Valores de exemplo, sem conta conectada.",[node("Chart")]),
                  block("DashboardCard",{"title":"Evolução do orçamento","value":"R$ 4.930,00"}),
                  card("Categorias","Mercado 38% · Transporte 22% · Lazer 18%"),
                  link("Consultar movimentações",1)]
        if index==4:return [text("Transferir · simulação",30),
                  card("Apenas demonstração",
                       "Nenhuma transferência real será realizada; não informe dados bancários verdadeiros.",
                       [node("TextField",{"label":"Destinatário fictício"}),
                        node("TextField",{"label":"Valor ilustrativo","keyboard":"number"}),
                        link("Concluir demonstração e voltar",0)]),
                  link("Ver transações",1)]
        return [block("ProfileHeader",{"title":"Seu perfil Nexa"}),
                card("Preferências","Privacidade, notificações e acessibilidade.",
                     [row([text("Notificações",16),node("Switch")])]),
                card("Segurança de demonstração","Sem conexão a contas bancárias ou dados reais."),
                link("Voltar ao início",0)]
    for index,screen in enumerate(d["screens"]):
        root=node("Surface")
        bind(root,"props","background","colors.background",colors["background"])
        root["layout"].update(width="fill",height="fill",padding=16,gap=14,scroll="none")
        root["layout"]["responsive"]={
           "medium":{"padding":32},"expanded":{"padding":48},
           "large":{"padding":64},"extraLarge":{"padding":80}}
        content=col([block("ModernAppBar",{"title":spec["app"]+" · "+screen["name"]})]
                    +sections(index),gap=16,padding=4)
        content["layout"].update(weight=1,scroll="vertical")
        body=col([content,navigation(index,False)],gap=8)
        body["layout"].update(height="fill",weight=1,maxWidth=720)
        outer=row([navigation(index,True),body],gap=12)
        outer["layout"].update(height="fill",arrangement="center")
        root["children"]=[outer]
        screen["root"]=root
        screen["metadata"]={"sampleData":True,"experience":spec["app"],"platform":"android"}
    return resolve_tokens(d)
