"""Generates public/scene.svg: a golden-hour college campus where students
stand in small circles on the lawn, practising group discussions."""
import random, math
random.seed(7)
W, H = 1600, 1000
out = []
a = out.append

a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">')
a('''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#2a63d6"/><stop offset="0.38" stop-color="#6fa3ee"/>
 <stop offset="0.62" stop-color="#cfe0f7"/><stop offset="0.74" stop-color="#ffd9ac"/><stop offset="0.82" stop-color="#ffc283"/>
</linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
 <stop offset="0" stop-color="#fff8e1"/><stop offset="0.25" stop-color="#ffe7a8" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/>
</radialGradient>
<linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#9ccf74"/><stop offset="0.5" stop-color="#6fb05c"/><stop offset="1" stop-color="#4c8f4c"/>
</linearGradient>
<linearGradient id="path" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#f6e7c8"/><stop offset="1" stop-color="#ead2a6"/>
</linearGradient>
<linearGradient id="wall" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0" stop-color="#e9a873"/><stop offset="0.7" stop-color="#f0b886"/><stop offset="1" stop-color="#d98f5c"/>
</linearGradient>
<linearGradient id="dome" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0" stop-color="#fbe9d4"/><stop offset="1" stop-color="#d9b694"/>
</linearGradient>
<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="haze"><feGaussianBlur stdDeviation="1.2"/></filter>
</defs>''')

a(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
a('<circle cx="1210" cy="640" r="300" fill="url(#sun)"/>')
a('<circle cx="1210" cy="640" r="46" fill="#fffaf0" opacity="0.95"/>')

# clouds
def cloud(cx, cy, s, op=0.92):
    parts = [(0,0,60,26),(-48,8,44,20),(50,6,48,22),(-14,-16,40,24),(24,-12,36,22)]
    g = [f'<g opacity="{op}" filter="url(#soft)">']
    for dx,dy,rx,ry in parts:
        g.append(f'<ellipse cx="{cx+dx*s:.1f}" cy="{cy+dy*s:.1f}" rx="{rx*s:.1f}" ry="{ry*s:.1f}" fill="#ffffff"/>')
    g.append('</g>')
    a(''.join(g))
cloud(180, 260, 1.4); cloud(1420, 210, 1.1); cloud(560, 150, 0.8, 0.75); cloud(1040, 330, 0.9, 0.8); cloud(80, 520, 1.0, 0.85); cloud(1530, 470, 0.9, 0.85)

# birds
for bx, by, s in [(980,240,1),(1010,228,0.8),(1040,250,0.7),(330,180,0.9),(355,168,0.7)]:
    a(f'<path d="M{bx} {by} q {6*s} {-6*s} {12*s} 0 q {6*s} {-6*s} {12*s} 0" fill="none" stroke="#2d3b63" stroke-width="2" stroke-linecap="round" opacity="0.7"/>')

# hills
a('<path d="M0 640 C 180 575 360 610 540 590 S 880 545 1100 590 S 1420 560 1600 600 V1000 H0Z" fill="#aab4dc" opacity="0.95" filter="url(#haze)"/>')
a('<path d="M0 690 C 240 640 460 690 700 665 S 1150 640 1360 680 S 1560 665 1600 672 V1000 H0Z" fill="#8f9fcd"/>')

# far trees line
for i in range(70):
    x = i*24 + random.uniform(-6,6)
    if 330 < x < 1270: continue
    r = random.uniform(14, 26)
    a(f'<circle cx="{x:.0f}" cy="{712 - r*0.6:.0f}" r="{r:.0f}" fill="{random.choice(["#5f8f6a","#6e9c70","#7a9f6b"])}"/>')

# lawn
a('<path d="M0 750 C 400 722 1200 722 1600 750 V1000 H0Z" fill="url(#lawn)"/>')

# ---------- campus building ----------
def cornice(x, y, w):
    a(f'<rect x="{x-6}" y="{y-10}" width="{w+12}" height="12" rx="2" fill="#fff4e4"/>')
    a(f'<rect x="{x-6}" y="{y+2}" width="{w+12}" height="4" fill="#c98252" opacity="0.6"/>')

# wings
for wx in (370, 1050):
    a(f'<rect x="{wx}" y="640" width="180" height="128" fill="url(#wall)"/>')
    cornice(wx, 640, 180)
    for j in range(4):
        x = wx + 18 + j*42
        a(f'<rect x="{x}" y="660" width="22" height="30" rx="2" fill="#7b4026"/><rect x="{x+3}" y="663" width="16" height="24" rx="1" fill="#ffd27a" opacity="{random.choice([0.95,0.75,0.55])}"/>')
        a(f'<path d="M{x} 742 v-22 a11 11 0 0 1 22 0 v22z" fill="#7b4026"/><path d="M{x+3} 742 v-20 a8 8 0 0 1 16 0 v20z" fill="#ffcf6e" opacity="0.85"/>')

# main block
a('<rect x="540" y="595" width="520" height="173" fill="url(#wall)"/>')
cornice(540, 595, 520)
a('<rect x="540" y="676" width="520" height="6" fill="#fff4e4"/>')
for j in range(10):
    x = 556 + j*50
    a(f'<rect x="{x}" y="616" width="26" height="40" rx="2" fill="#7b4026"/><rect x="{x+3}" y="619" width="20" height="34" rx="1" fill="#ffd27a" opacity="{random.choice([0.95,0.8,0.6])}"/>')
    a(f'<path d="M{x-4} 766 v-46 a17 17 0 0 1 34 0 v46z" fill="#7b4026"/><path d="M{x} 766 v-44 a13 13 0 0 1 26 0 v44z" fill="#ffc861" opacity="0.9"/>')
# porch + steps
a('<rect x="740" y="690" width="120" height="78" fill="#f6ddc0"/>')
for k in range(4):
    a(f'<rect x="{746+k*30}" y="700" width="8" height="68" fill="#fff4e4"/>')
a('<path d="M726 690 L800 650 L874 690Z" fill="#fff4e4"/><path d="M742 686 L800 656 L858 686Z" fill="#e9a873"/>')
a('<path d="M728 768 h144 l14 10 h-172z" fill="#efe1c9"/><path d="M714 778 h172 l14 10 h-200z" fill="#e6d4b7"/>')

# clock tower
a('<rect x="764" y="478" width="72" height="118" fill="url(#wall)"/>')
cornice(764, 478, 72)
a('<circle cx="800" cy="520" r="20" fill="#fffaf0" stroke="#7b4026" stroke-width="3"/>')
a('<path d="M800 520 v-13 M800 520 l9 5" stroke="#2d3b63" stroke-width="2.5" stroke-linecap="round"/>')
a('<rect x="788" y="552" width="24" height="34" rx="12" fill="#7b4026"/><rect x="791" y="556" width="18" height="28" rx="9" fill="#ffd27a"/>')
a('<path d="M758 468 h84 q -2 -46 -42 -60 q -40 14 -42 60z" fill="url(#dome)"/>')
a('<rect x="798" y="388" width="4" height="22" fill="#7b4026"/><path d="M802 390 l18 6 l-18 6z" fill="#f05a3a"/>')

# ---------- trees ----------
def tree(x, y, s, palette):
    a(f'<rect x="{x-4*s:.1f}" y="{y-34*s:.1f}" width="{8*s:.1f}" height="{36*s:.1f}" rx="{3*s:.1f}" fill="#6b4630"/>')
    c1, c2 = palette
    for dx, dy, r, c in [(-18,-50,24,c2),(16,-52,26,c2),(0,-70,30,c1),(-6,-46,22,c1),(14,-74,20,c1)]:
        a(f'<circle cx="{x+dx*s:.1f}" cy="{y+dy*s:.1f}" r="{r*s:.1f}" fill="{c}"/>')
    a(f'<circle cx="{x-8*s:.1f}" cy="{y-80*s:.1f}" r="{10*s:.1f}" fill="#ffffff" opacity="0.18"/>')

def pine(x, y, s, c):
    a(f'<rect x="{x-3*s:.1f}" y="{y-14*s:.1f}" width="{6*s:.1f}" height="{16*s:.1f}" fill="#5b3b28"/>')
    for k, (w, h) in enumerate([(30,40),(24,36),(17,30)]):
        yy = y - 12*s - k*24*s
        a(f'<path d="M{x-w*s:.1f} {yy:.1f} L{x:.1f} {yy-h*s:.1f} L{x+w*s:.1f} {yy:.1f}Z" fill="{c}"/>')

GREEN = ("#5aa25a", "#3f8a4c")
AUTUMN = ("#f2a33a", "#e07a2e")
GOLD = ("#f6c445", "#e3a12f")
RUST = ("#e0673c", "#c24f2c")
pine(335, 770, 1.4, "#2f7a4f"); pine(1265, 770, 1.5, "#2f7a4f")
tree(300, 778, 1.2, AUTUMN); tree(1300, 780, 1.25, GOLD)
tree(190, 800, 1.5, GREEN); tree(1420, 805, 1.55, RUST)
tree(70, 840, 1.9, GOLD); tree(1540, 845, 1.9, GREEN)
pine(1490, 800, 1.6, "#2b6f48"); pine(120, 795, 1.5, "#2b6f48")
tree(490, 770, 0.9, GREEN); tree(1110, 770, 0.95, AUTUMN)

# ---------- path to the building ----------
a('<path d="M728 788 L872 788 L1120 1000 L480 1000Z" fill="url(#path)"/>')
a('<path d="M728 788 L480 1000 M872 788 L1120 1000" stroke="#d9bf92" stroke-width="3" opacity="0.8"/>')

# lamp posts along the path
for t in (0.18, 0.45, 0.8):
    for side in (-1, 1):
        x0 = 800 + side*(72 + t*248)
        y0 = 788 + t*212
        s = 0.7 + t*1.3
        x = x0 + side*24*s
        a(f'<rect x="{x-1.6*s:.1f}" y="{y0-60*s:.1f}" width="{3.2*s:.1f}" height="{60*s:.1f}" fill="#2d3b63"/>')
        a(f'<circle cx="{x:.1f}" cy="{y0-62*s:.1f}" r="{9*s:.1f}" fill="#ffe08a" opacity="0.35"/><circle cx="{x:.1f}" cy="{y0-62*s:.1f}" r="{4.5*s:.1f}" fill="#fff1c2"/>')

# ---------- students in GD circles ----------
SKIN = ["#f1c7a0", "#d9a77c", "#b97e55", "#8d5a3b", "#e8b98f"]
CLOTH = ["#2d5da8", "#c2412d", "#1f7a6d", "#6b4fa0", "#f0a82a", "#e86a92", "#ffffff", "#2d3b63", "#f2d04a"]
HAIR = ["#1f1a17", "#2b1d14", "#3a2618", "#141210"]

def person(x, y, s, facing=0):
    c = random.choice(CLOTH)
    a(f'<ellipse cx="{x:.1f}" cy="{y+1*s:.1f}" rx="{8*s:.1f}" ry="{2.6*s:.1f}" fill="#2f5d36" opacity="0.35"/>')
    a(f'<rect x="{x-3.6*s:.1f}" y="{y-10*s:.1f}" width="{2.8*s:.1f}" height="{10*s:.1f}" fill="#2d3b63"/><rect x="{x+0.8*s:.1f}" y="{y-10*s:.1f}" width="{2.8*s:.1f}" height="{10*s:.1f}" fill="#2d3b63"/>')
    a(f'<rect x="{x-5.5*s:.1f}" y="{y-24*s:.1f}" width="{11*s:.1f}" height="{16*s:.1f}" rx="{4*s:.1f}" fill="{c}"/>')
    a(f'<circle cx="{x:.1f}" cy="{y-29*s:.1f}" r="{5*s:.1f}" fill="{random.choice(SKIN)}"/>')
    a(f'<path d="M{x-5.2*s:.1f} {y-29*s:.1f} a{5.2*s:.1f} {5.2*s:.1f} 0 0 1 {10.4*s:.1f} 0 q {-5*s:.1f} {-2*s:.1f} {-10.4*s:.1f} 0z" fill="{random.choice(HAIR)}"/>')

def group(cx, cy, s, n=5, spread=1.0):
    pts = []
    for i in range(n):
        ang = -math.pi/2 + i*2*math.pi/n + random.uniform(-0.2, 0.2)
        pts.append((cx + math.cos(ang)*16*s*spread, cy + math.sin(ang)*6*s*spread))
    for x, y in sorted(pts, key=lambda p: p[1]):
        person(x, y, s)

group(300, 880, 1.6, 5)
group(1290, 875, 1.6, 6)
group(560, 930, 2.1, 5)
group(1060, 950, 2.3, 6)
group(140, 960, 2.4, 4, 1.1)
group(1480, 965, 2.5, 5)
group(420, 815, 1.05, 4)
group(1180, 815, 1.05, 5)
# a few walking on the path
for x, y, s in [(780, 840, 1.1), (840, 870, 1.3), (760, 935, 1.7)]:
    person(x, y, s)

a('</svg>')
open('public/scene.svg', 'w').write('\n'.join(out))
print(len('\n'.join(out)), 'bytes')
