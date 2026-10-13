from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Register IBM Plex fonts (using DejaVu as fallback since IBM Plex may not be installed)
# We'll simulate the look with standard fonts
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_MONO = "Courier"
FONT_MONO_BOLD = "Courier-Bold"

# Colors
DARK_GRAY = HexColor("#333333")
MED_GRAY = HexColor("#666666")
LIGHT_BLUE_LINE = HexColor("#C8CCD2")
ORANGE_BULLET = HexColor("#96430F")
WHITE = HexColor("#FFFFFF")

PAGE_W, PAGE_H = A4
MARGIN_LEFT = 40
MARGIN_RIGHT = 40
MARGIN_TOP = 36
MARGIN_BOTTOM = 36
CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT

c = canvas.Canvas(
    r"C:\Users\Jordan\Documents\workspace\EduardoFerreira\public\Curriculo-Eduardo-Ferreira-2026.pdf",
    pagesize=A4
)

y = PAGE_H - MARGIN_TOP

def draw_text(x, y, text, font=FONT_REGULAR, size=10, color=DARK_GRAY):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)
    return c.stringWidth(text, font, size)

def draw_mono(x, y, text, size=7.2, color=DARK_GRAY, bold=False):
    font = FONT_MONO_BOLD if bold else FONT_MONO
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)
    return c.stringWidth(text, font, size)

def draw_bold(x, y, text, size=10, color=DARK_GRAY):
    return draw_text(x, y, text, FONT_BOLD, size, color)

def draw_line(x1, y1, x2, y2, color=LIGHT_BLUE_LINE, width=0.75):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)

def draw_bullet(x, y, size=3):
    c.setFillColor(ORANGE_BULLET)
    c.circle(x + size/2, y + 3, size/2, fill=1, stroke=0)

def section_title(title, y_pos):
    # Draw line before section
    draw_line(MARGIN_LEFT + 50, y_pos + 2, PAGE_W - MARGIN_RIGHT, y_pos + 2)
    # Title
    draw_bold(MARGIN_LEFT, y_pos - 14, title, size=11)
    return y_pos - 28

def body_text(x, y, text, size=9, leading=13, color=DARK_GRAY, font=FONT_REGULAR):
    c.setFont(font, size)
    c.setFillColor(color)
    textobject = c.beginText(x, y)
    textobject.setLeading(leading)
    for line in text.split('\n'):
        textobject.textLine(line)
    c.drawText(textobject)
    # Return new y position
    lines = text.count('\n') + 1
    return y - (lines * leading)

def bullet_point(x, y, text, bullet_x=None, size=9, leading=13, indent=0):
    if bullet_x is None:
        bullet_x = x
    draw_bullet(bullet_x, y - 2)
    c.setFont(FONT_REGULAR, size)
    c.setFillColor(DARK_GRAY)
    textobject = c.beginText(x + 12 + indent, y)
    textobject.setLeading(leading)
    for line in text.split('\n'):
        textobject.textLine(line)
    c.drawText(textobject)
    lines = text.count('\n') + 1
    return y - (lines * leading)

# ========== HEADER ==========
# Name
draw_bold(MARGIN_LEFT, y, "Eduardo Alexandre da Silva Ferreira", size=17.5)
y -= 26

# Title line
draw_mono(MARGIN_LEFT, y, "DESENVOLVEDOR FULL-STACK \u2014 JAVA & REACT/TYPESCRIPT", size=8, bold=True)
y -= 20

# Contact info
contact_lines = [
    "S\u00e3o Paulo, SP \u2014 (11) 94990-7847 \u2014 edualexandre2017@outlook.com \u2014 linkedin.com/in/eduardoalexandre-java \u2014 github.com/iHadesj",
    "edu-ferreira.vercel.app"
]
for line in contact_lines:
    draw_mono(MARGIN_LEFT, y, line, size=7.2)
    y -= 11

y -= 6

# ========== RESUMO ==========
y = section_title("RESUMO", y)
resumo_text = (
    "Desenvolvedor full-stack com base s\u00f3lida em Java e pr\u00e1tica consistente em React e TypeScript. "
    "Atuei na constru\u00e7\u00e3o do Portal VTT (painel de gest\u00e3o de PDV + ferramentas internas + jogos personaliz\u00e1veis para totens de eventos) do zero, "
    "com foco em front-end (React/TypeScript/Three.js) e integra\u00e7\u00e3o com back-end Java (servlets, endpoints para dashboards, CRUD). "
    "Cursando An\u00e1lise e Desenvolvimento de Sistemas na Est\u00e1cio. Construo projetos pr\u00f3prios de ponta a ponta \u2014 modelagem de dom\u00ednio, persist\u00eancia, testes automatizados e performance \u2014 "
    "priorizando regras de neg\u00f3cio expl\u00edcitas e estado previs\u00edvel. Iniciando estudos em Angular."
)
y = body_text(MARGIN_LEFT, y, resumo_text, size=9, leading=13)
y -= 6

# ========== EXPERI\u00caNCIA ==========
y = section_title("EXPERI\u00caNCIA", y)

# VTT
draw_bold(MARGIN_LEFT, y, "Estagi\u00e1rio de Desenvolvimento Web \u2014 VTT", size=10)
draw_mono(MARGIN_LEFT + 300, y, "fev 2025 \u2014 out 2026", size=8, color=MED_GRAY)
y -= 14
draw_mono(MARGIN_LEFT, y, "S\u00e3o Paulo, SP", size=8, color=MED_GRAY)
y -= 16

# Portal VTT description
y = body_text(MARGIN_LEFT + 10, y, "Portal VTT \u2014 Constru\u00e7\u00e3o do zero (front-end principal + integra\u00e7\u00e3o back-end)", size=9, leading=13, font=FONT_BOLD)
y -= 4

bullets_vtt = [
    "Gest\u00e3o de PDV & cadastros: interfaces para cadastro/edi\u00e7\u00e3o/listagem de pontos de venda, usu\u00e1rios, terminais e configura\u00e7\u00f5es",
    "Ferramentas internas: dashboards com dados reais, gr\u00e1ficos e anima\u00e7\u00f5es Three.js para visualiza\u00e7\u00e3o de m\u00e9tricas",
    "Jogos personaliz\u00e1veis para totens de eventos (destaque): editor visual no browser para Jogo da Mem\u00f3ria, Quiz, Formul\u00e1rio Cativo, Roleta; gera\u00e7\u00e3o e download de pacote .zip com o projeto personalizado (assets, config, build) pronto para deploy no totem; arquitetura modular permitindo adicionar novos tipos de jogo sem refatorar o core",
    "Gest\u00e3o de chamados: m\u00f3dulo completo de tickets (abertura, acompanhamento, SLA, relat\u00f3rios)",
    "Back-end (suporte): servlets e endpoints REST para alimentar dashboards, CRUDs e anima\u00e7\u00f5es Three.js",
    "Stack: React \u2022 TypeScript \u2022 JavaScript \u2022 Java (Servlets) \u2022 Three.js \u2022 Git",
    "Entregas: aplica\u00e7\u00e3o em produ\u00e7\u00e3o, investiga\u00e7\u00e3o/reprodu\u00e7\u00e3o/corre\u00e7\u00e3o de defeitos, versionamento e code review em equipe"
]

for bullet in bullets_vtt:
    y = bullet_point(MARGIN_LEFT + 10, y, bullet, bullet_x=MARGIN_LEFT + 2, size=8.5, leading=12, indent=0)
    y -= 2

y -= 6

# ========== COMPET\u00caNCIAS T\u00c9CNICAS ==========
y = section_title("COMPET\u00caNCIAS T\u00c9CNICAS", y)

skills = [
    ("BACK-END", "Java, Spring Boot, JPA / Hibernate, PostgreSQL, Maven, Docker, Servlets"),
    ("FRONT-END", "TypeScript, React, Next.js, JavaScript, Tailwind CSS, CSS Modules, HTML sem\u00e2ntico, Three.js, Angular (iniciando estudos)"),
    ("ESTADO & DADOS", "Zustand, TanStack Query, Dexie / IndexedDB, Zod, React Router, SQL"),
    ("TESTES & TOOLING", "JUnit, Vitest, Playwright, ESLint, Prettier, Vite, Git, IntelliJ IDEA"),
    ("FUNDAMENTOS", "POO, estruturas de dados, padr\u00f5es de projeto, Generics, Collections, tratamento de exce\u00e7\u00f5es, PWA / offline-first, acessibilidade, performance web"),
    ("IDIOMAS", "Portugu\u00eas (nativo) \u2022 Ingl\u00eas (intermedi\u00e1rio)")
]

for label, value in skills:
    draw_bold(MARGIN_LEFT, y, label, size=9)
    y -= 12
    y = body_text(MARGIN_LEFT + 10, y, value, size=8.5, leading=12, color=MED_GRAY)
    y -= 4

y -= 4

# ========== PROJETOS ==========
y = section_title("PROJETOS", y)

projects = [
    ("Levva \u2014 Loja & Sorte", "github.com/iHadesj/Levva-loja-e-sorte",
     "PWA de e-commerce com cat\u00e1logo determin\u00edstico de 400 produtos, busca tolerante a erros (Fuse.js) e grade virtualizada. "
     "Checkout transacional em IndexedDB com estorno compensat\u00f3rio, valores financeiros como inteiros (centavos). "
     "29 testes automatizados cobrindo regras cr\u00edticas de checkout/financeiro.",
     "React \u2022 TypeScript \u2022 Zustand \u2022 Dexie/IndexedDB \u2022 Fuse.js \u2022 Vitest \u2022 PWA"),
    ("Portf\u00f3lio Pessoal", "edu-ferreira.vercel.app",
     "Site bil\u00edngue com conte\u00fado tipado e validado em build (Velite), experi\u00eancias 3D (Three.js), anima\u00e7\u00f5es (Motion), "
     "cobertura por testes unit\u00e1rios e end-to-end.",
     "Next.js \u2022 React \u2022 TypeScript \u2022 Tailwind \u2022 Three.js \u2022 Playwright"),
    ("Rota Dev", "github.com/iHadesj/RotaDev",
     "Trilha de estudos gamificada com curr\u00edculo declarativo, execu\u00e7\u00e3o de desafios em sandbox no navegador e m\u00f3dulos de projeto "
     "liberados por crit\u00e9rios de aceite \u2014 n\u00e3o apenas por quiz.",
     "React \u2022 JavaScript \u2022 Framer Motion \u2022 Arquitetura por dom\u00ednio"),
    ("CRUD Java MVC + JPA/PostgreSQL", "github.com/iHadesj/Projeto_CRUD",
     "Aplica\u00e7\u00e3o Java em Model-View-Controller: entidades, controladores com rotas para cada opera\u00e7\u00e3o do CRUD, interfaces de reposit\u00f3rio, "
     "mapeamento e persist\u00eancia com JPA sobre PostgreSQL.",
     "Java \u2022 MVC \u2022 JPA / Hibernate \u2022 PostgreSQL")
]

for name, link, desc, stack in projects:
    # Check if we need new page
    if y < 100:
        c.showPage()
        y = PAGE_H - MARGIN_TOP
    
    draw_bold(MARGIN_LEFT, y, name, size=10)
    draw_mono(MARGIN_LEFT + 280, y, link, size=7.5, color=MED_GRAY)
    y -= 13
    y = body_text(MARGIN_LEFT + 10, y, desc, size=8.5, leading=12)
    y -= 3
    draw_mono(MARGIN_LEFT + 10, y, stack, size=7.5, color=MED_GRAY)
    y -= 16

y -= 4

# ========== FORMA\u00c7\u00c3O ==========
y = section_title("FORMA\u00c7\u00c3O", y)

education = [
    ("An\u00e1lise e Desenvolvimento de Sistemas \u2014 Est\u00e1cio", "fev 2025 \u2014 previs\u00e3o dez 2026"),
    ("Curso Livre Profissionalizante, Back-End Java \u2014 EBAC", "set 2023 \u2014 out 2024"),
    ("Ensino M\u00e9dio \u2014 E. E. Mariazinha Conr\u00f3lio", "fev 2022 \u2014 dez 2024")
]

for course, date in education:
    draw_bold(MARGIN_LEFT, y, course, size=9.5)
    draw_mono(MARGIN_LEFT + 320, y, date, size=8, color=MED_GRAY)
    y -= 14

y -= 4

# ========== DIFERENCIAIS ==========
if y > 120:
    y = section_title("DIFERENCIAIS", y)
    diffs = [
        "Testes reais nos projetos: 29 testes no Levva (regras financeiras), unit + e2e no portf\u00f3lio",
        "Offline-first & PWA: IndexedDB transacional, Service Worker (Workbox), instala\u00e7\u00e3o nativa",
        "Valida\u00e7\u00e3o em build: Velite (tipagem + valida\u00e7\u00e3o de conte\u00fado no portf\u00f3lio)",
        "Arquitetura por dom\u00ednio: separa\u00e7\u00e3o clara de regras de neg\u00f3cio, UI e infraestrutura",
        "Jogos para totens: gera\u00e7\u00e3o de builds personalizados (.zip) via editor no browser"
    ]
    for diff in diffs:
        y = bullet_point(MARGIN_LEFT, y, diff, bullet_x=MARGIN_LEFT - 8, size=8.5, leading=12)
        y -= 2

c.save()
print("PDF gerado com sucesso!")