"""Isolated loopback origin serving immutable, bounded project snapshots only.
No bridge routes, filesystem paths, cookies, backend evaluation or user-code execution.
"""

from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from threading import Thread, RLock
from secrets import token_urlsafe
from urllib.parse import unquote, urlsplit, quote
import mimetypes, time, json
from html.parser import HTMLParser
from ..domain.files import validate_files, safe_path


class PreviewRuntime:
    def __init__(self):
        self.sessions = {}
        self.lock = RLock()
        self.server = None

    def start(self):
        with self.lock:
            if self.server:
                return
            runtime = self

            class Handler(BaseHTTPRequestHandler):
                def log_message(self, *args):
                    pass

                def do_GET(self):
                    runtime.respond(self)

                def do_OPTIONS(self):
                    self.send_response(204)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                    self.end_headers()

            self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            Thread(
                target=self.server.serve_forever, daemon=True, name="agata-preview"
            ).start()

    @property
    def origin(self):
        self.start()
        return "http://127.0.0.1:" + str(self.server.server_address[1])

    def prepare(self, files, entry="index.html", network=False, session=None):
        raw = validate_files(files)
        entry = safe_path(entry)
        if entry not in raw or not entry.lower().endswith((".html", ".htm")):
            raise ValueError("Página de entrada HTML não encontrada.")
        self.start()
        with self.lock:
            now = time.monotonic()
            self.sessions = {
                k: v for k, v in self.sessions.items() if now - v["created"] < 3600
            }
            if len(self.sessions) >= 8:
                self.sessions.pop(next(iter(self.sessions)))
            token = session if session in self.sessions else token_urlsafe(32)
            old = self.sessions.get(token)
            version = (old["version"] if old else 0) + 1
            nonce = old["nonce"] if old else token_urlsafe(24)
            versions = dict(old["versions"]) if old else {}
            versions[version] = raw
            for key in sorted(versions)[:-3]:
                versions.pop(key)
            self.sessions[token] = {
                "created": now,
                "version": version,
                "versions": versions,
                "nonce": nonce,
                "network": bool(network),
            }

            def size():
                return sum(
                    len(data)
                    for s in self.sessions.values()
                    for files in s["versions"].values()
                    for data in files.values()
                )

            while size() > 128_000_000:
                other = next((key for key in self.sessions if key != token), None)
                if other:
                    self.sessions.pop(other)
                elif len(versions) > 1:
                    versions.pop(min(versions))
                else:
                    break
            return {
                "url": self.origin
                + "/s/"
                + token
                + "/"
                + str(version)
                + "/"
                + quote(entry, safe="/"),
                "origin": self.origin,
                "nonce": nonce,
                "session": token,
                "version": version,
            }

    def close(self, session):
        with self.lock:
            self.sessions.pop(session, None)
        return {"ok": True}

    def policy(self, network):
        origin = self.origin
        https = " https:" if network else ""
        return f"sandbox allow-scripts allow-forms; default-src 'none'; script-src {origin} 'unsafe-inline'; style-src {origin} 'unsafe-inline'; img-src {origin} data: blob:{https}; font-src {origin} data:; media-src {origin} data:{https}; connect-src {origin}{https}; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action {origin}; worker-src 'none'; manifest-src 'none'"

    def respond(self, handler):
        try:
            parsed = urlsplit(handler.path)
            parts = parsed.path.split("/", 4)
            if len(parts) != 5 or parts[1] != "s":
                raise ValueError("Unknown route")
            token, version, name = parts[2], int(parts[3]), safe_path(unquote(parts[4]))
            with self.lock:
                session = self.sessions.get(token)
                if not session or time.monotonic() - session["created"] > 3600:
                    raise ValueError("Expired")
                data = session["versions"].get(version, {}).get(name)
                if data is None:
                    raise ValueError("Unknown file")
                nonce = session["nonce"]
                policy = self.policy(session["network"])
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
            if name.lower().endswith((".js", ".mjs")):
                content_type = "application/javascript"
            if name.lower().endswith((".html", ".htm")):
                content_type = "text/html"
                instrument = self.instrument(nonce)
                # Instrumentation runs before project scripts. No project string enters editor DOM.
                text = data.decode("utf-8")

                class Head(HTMLParser):
                    injection_offset = None
                    html_offset = None
                    doctype = 0

                    def locate(self):
                        row, column = self.getpos()
                        return (
                            sum(
                                len(line)
                                for line in text.splitlines(keepends=True)[: row - 1]
                            )
                            + column
                        )

                    def handle_starttag(self, tag, attrs):
                        if tag == "head" and self.injection_offset is None:
                            self.injection_offset = self.locate() + len(
                                self.get_starttag_text()
                            )
                        if tag == "html" and self.html_offset is None:
                            self.html_offset = self.locate() + len(
                                self.get_starttag_text()
                            )

                    def handle_decl(self, decl):
                        self.doctype = self.locate() + len(decl) + 3

                parser = Head(convert_charrefs=False)
                parser.feed(text)
                if parser.injection_offset is not None:
                    offset = parser.injection_offset
                    addition = instrument
                else:
                    offset = parser.html_offset or parser.doctype
                    addition = "<head>" + instrument + "</head>"
                text = text[:offset] + addition + text[offset:]
                data = text.encode()
            handler.send_response(200)
            handler.send_header(
                "Content-Type",
                (
                    content_type + "; charset=utf-8"
                    if content_type.startswith("text/")
                    or content_type == "application/javascript"
                    else content_type
                ),
            )
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Access-Control-Allow-Origin", "*")
            handler.send_header("Cross-Origin-Resource-Policy", "cross-origin")
            handler.send_header("Referrer-Policy", "no-referrer")
            handler.send_header("X-Content-Type-Options", "nosniff")
            handler.send_header("Cache-Control", "no-store")
            handler.send_header("Content-Security-Policy", policy)
            handler.end_headers()
            handler.wfile.write(data)
        except (ValueError, UnicodeError, KeyError):
            handler.send_error(404, "Preview resource not available")

    @staticmethod
    def instrument(nonce):
        return (
            "<script>"
            + r"""(()=>{'use strict';const nonce="""
            + json.dumps(nonce)
            + r""";const prefix=location.pathname.split('/').slice(0,4).join('/')+'/';const originalFetch=window.fetch.bind(window);window.fetch=(input,options)=>{if(typeof input==='string'&&input.startsWith('/')&&!input.startsWith('//'))input=location.origin+prefix+input.slice(1);return originalFetch(input,options)};const send=(type,data)=>parent.postMessage({agataPreview:1,nonce,type,data},'*');for(const level of ['log','info','warn','error']){const original=console[level];console[level]=(...args)=>{send('console',{level,text:args.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}}).join(' ').slice(0,6000)});original.apply(console,args)}};addEventListener('error',e=>send('console',{level:'error',text:String(e.message).slice(0,6000)}));addEventListener('unhandledrejection',e=>send('console',{level:'error',text:String(e.reason).slice(0,6000)}));addEventListener('click',e=>{const node=e.target.closest('[data-agata-id]');if(node){let includeId=null;for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName.toLowerCase()==='agata-include'){includeId=p.dataset.agataId;break;}send('select',{id:node.dataset.agataId,includeId});}const a=e.target.closest('a[href]');if(a){const url=new URL(a.getAttribute('href'),location.href);if(url.origin!==location.origin){e.preventDefault();send('console',{level:'warn',text:'Navegação externa bloqueada no Preview: '+url.protocol});}}},true);send('ready',{});})();"""
            + "</script>"
        )


RUNTIME = PreviewRuntime()
