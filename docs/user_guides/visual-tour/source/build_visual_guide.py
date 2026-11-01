"""Build a screenshot-led PDF with vector annotations; originals stay unchanged."""
from pathlib import Path
import json, html, hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
FONTS = ROOT / 'assets/fonts'
for name, file in [('Sans','GoogleSansFlex-Regular.ttf'),('SansBold','GoogleSansFlex-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTS/file)))
W,H=1080,1120
INK=HexColor('#182622'); MUTED=HexColor('#53655e'); GREEN=HexColor('#185b49')
PURPLE=HexColor('#6550ae'); PAPER=HexColor('#f5f7f2'); LIGHT=HexColor('#e6eee6')
def para(c,text,x,y,w,size=13,color=INK,bold=False):
    p=Paragraph(text,ParagraphStyle('p',fontName='SansBold' if bold else 'Sans',fontSize=size,leading=size*1.38,textColor=color))
    _,h=p.wrap(w,1000); p.drawOn(c,x,y-h); return y-h
def label(c,text,x,y,color=MUTED,size=10):
    c.setFillColor(color);c.setFont('SansBold',size);c.drawString(x,y,text)
def box(c,x,y,w,h,fill=white,r=14):
    c.setFillColor(fill);c.roundRect(x,y,w,h,r,fill=1,stroke=0)
def badge(c,n,x,y):
    c.setFillColor(PURPLE);c.setStrokeColor(white);c.setLineWidth(2)
    c.circle(x,y,13,fill=1,stroke=1);c.setFillColor(white);c.setFont('SansBold',12);c.drawCentredString(x,y-4,str(n))
def footer(c,n):
    label(c,'BA MATE / VISUAL FIELD GUIDE / FICTIONAL PRACTICE',36,24,size=9)
    label(c,f'1 NOV 2026  ·  BETA.3  /  {n:02}',873,24,size=9)
def frame(c,kicker,title,subtitle,n):
    c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(GREEN);c.rect(0,H-9,W,9,fill=1,stroke=0)
    label(c,kicker.upper(),36,1080,GREEN,11)
    para(c,title,36,1062,1008,29,bold=True)
    para(c,subtitle,36,1014,1008,13,MUTED)
    footer(c,n)

def build():
    data=json.loads((ROOT/'source/tour.json').read_text())
    target=ROOT/'BA-Mate-Visual-Guide-v1.0.0-beta.3.pdf'
    c=canvas.Canvas(str(target),pagesize=(W,H),pageCompression=1)
    c.setTitle('BA Mate - A beginner\'s visual guided tour');c.setAuthor('BA Mate research project')
    for n,p in enumerate(data,1):
        c.bookmarkPage(f'page{n}');c.addOutlineEntry(p['title'],f'page{n}',0)
        frame(c,p['stage'],p['title'],p['subtitle'],n)
        if p.get('shot'):
            im=ROOT/'screenshots'/p['shot'];iw,ih=Image.open(im).size
            scale=min(1008/iw,700/ih);sw,sh=iw*scale,ih*scale
            x=36+(1008-sw)/2;y=275+(700-sh)/2
            box(c,30,269,1020,712,white)
            c.drawImage(str(im),x,y,sw,sh)
            for i,pt in enumerate(p.get('pins',[]),1):
                px,py=x+pt[0]*sw,y+(1-pt[1])*sh
                bx=max(x+15,min(x+sw-15,px-23))
                by=max(y+15,min(y+sh-15,py+23))
                c.setStrokeColor(PURPLE);c.setLineWidth(2)
                c.line(px,py,bx,by)
                badge(c,i,bx,by)
            rx=36;yy=245
            for i,item in enumerate(p['steps'],1):
                xx=rx+(i-1)*344
                badge(c,i,xx+13,yy-10)
                by=para(c,item[0],xx+36,yy,284,16,bold=True)-7
                by=para(c,item[1],xx+36,by,284,13,MUTED)
                if by<104:raise ValueError(f'Teaching card too long: page {n}, card {i}')
            box(c,36,47,1008,48,LIGHT)
            label(c,'CHECK',52,68,GREEN)
            para(c,p['result'],112,80,914,12)
        else:
            yy=950
            for i,item in enumerate(p['steps'],1):
                xx=36+i%2*518 if False else 36+(i-1)%2*518
                if i%2==1 and i>1: yy-=220
                box(c,xx,yy-195,490,195,white)
                badge(c,i,xx+28,yy-29)
                para(c,item[0],xx+54,yy-17,408,19,bold=True)
                para(c,item[1],xx+24,yy-65,440,15,MUTED)
                if p.get('links'):
                    c.linkRect('',f'page{p["links"][i-1]}',(xx,yy-195,xx+490,yy),relative=0,thickness=0)
            if p.get('result'):
                box(c,36,90,1008,150,LIGHT)
                label(c,'PRACTICE CHECKPOINT',56,215,GREEN)
                para(c,p['result'],56,193,962,17)
        c.showPage()
    c.save()
    manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'screenshots').glob('*.jpg'))}
    (ROOT/'source/screenshot-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    make_gallery(data,target.name)
    print(target)

def make_gallery(data,pdf):
    payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c')
    template='''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BA Mate - Visual field guide</title><style>
*{box-sizing:border-box}body{margin:0;background:#e8eee8;color:#182622;font:16px system-ui,sans-serif}
header{position:sticky;top:0;background:#185b49;color:white;padding:16px 22px;display:flex;align-items:center;gap:18px;z-index:2}
header strong{font-size:21px}a{color:inherit}header a{margin-left:auto}button,input{font:inherit;border:1px solid #c8d4cd;border-radius:7px;padding:9px 12px;background:white;color:#182622}
button{cursor:pointer}button:disabled{opacity:.4;cursor:default}aside{position:fixed;top:64px;bottom:0;width:300px;background:#f5f7f2;overflow:auto;padding:18px}
input{width:100%;margin-bottom:14px}#toc button{display:block;text-align:left;width:100%;margin:4px 0;background:transparent;border:0;font-size:14px}#toc button.current{background:#e5dff6;font-weight:700}
main{margin-left:300px;padding:20px;max-width:1500px}.controls{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}.controls span{margin-right:auto}figure{margin:0}figure img{display:block;width:100%;height:auto;box-shadow:0 3px 18px #18262222}figcaption{font-size:13px;margin-top:12px;color:#53655e}
details{background:#f5f7f2;padding:18px;margin-top:18px;line-height:1.6}details li{margin-bottom:12px}footer{margin:22px 0;font-size:14px;color:#53655e}
@media(max-width:850px){aside{position:static;width:auto;max-height:230px}main{margin-left:0;padding:12px}header{position:static;flex-wrap:wrap}}
</style><header><strong>BA Mate / Visual field guide</strong><span>Desktop screenshot tour</span><a href="__PDF__">Open PDF</a></header>
<aside aria-label="Guide contents"><label for="search">Find a topic</label><input id="search" type="search" placeholder="Try evidence, backup or story"><nav id="toc"></nav></aside>
<main><div class="controls"><button id="prev">← Previous</button><span id="count" aria-live="polite"></span><button id="next">Next →</button></div>
<figure><img id="page" alt=""><figcaption id="caption"></figcaption></figure>
<details><summary>Read the instructions as text</summary><h2 id="title"></h2><p id="route"></p><ol id="steps"></ol><p id="result"></p></details>
<footer>Fictional practice only. <a href="practice/practice-cash-checkout.txt">Starting brief</a> · <a href="practice/Practice-Cash-Checkout-completed.zip">Completed project backup</a> · <a href="README.md">Package notes</a></footer></main>
<script>const pages=__DATA__;let current=0;const $=id=>document.getElementById(id);
function show(i){current=Math.max(0,Math.min(pages.length-1,i));const p=pages[current];$('page').src='pages/page-'+String(current+1).padStart(2,'0')+'.png';$('page').alt=p.title+' — '+p.subtitle;$('title').textContent=p.title;$('route').textContent=p.subtitle;$('count').textContent='Page '+(current+1)+' of '+pages.length+' / '+p.stage;$('caption').textContent='Click the PDF link for bookmarks and scalable text. Original desktop screenshots are retained in the screenshots folder.';$('steps').replaceChildren();p.steps.forEach(s=>{const li=document.createElement('li'),b=document.createElement('strong');b.textContent=s[0]+': ';li.append(b,document.createTextNode(s[1]));$('steps').append(li)});$('result').textContent='Check: '+p.result;$('prev').disabled=current===0;$('next').disabled=current===pages.length-1;document.querySelectorAll('#toc button').forEach((b,j)=>b.classList.toggle('current',Number(b.dataset.index)===current));history.replaceState(null,'','#page-'+(current+1));}
function toc(){const q=$('search').value.toLowerCase();$('toc').replaceChildren();pages.forEach((p,i)=>{if(JSON.stringify(p).toLowerCase().includes(q)){const b=document.createElement('button');b.textContent=(i+1)+'. '+p.title;b.dataset.index=i;b.onclick=()=>show(i);b.classList.toggle('current',i===current);$('toc').append(b)}})}
$('prev').onclick=()=>show(current-1);$('next').onclick=()=>show(current+1);$('search').oninput=toc;document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1)});toc();show(Number(location.hash.replace('#page-',''))-1||0);</script></html>'''
    (ROOT/'index.html').write_text(template.replace('__PDF__',html.escape(pdf)).replace('__DATA__',payload))

if __name__=='__main__':build()
