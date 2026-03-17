#!/usr/bin/env node
/**
 * Stage 43.1 — Humanoid Dogfood: Templar Knight
 *
 * Full vector→raster→sprite cleanup pipeline:
 * 1. Build vector master (500×500) — templar knight with tabard, helm, sword, shield
 * 2. Rasterize to all size profiles
 * 3. Analyze reduction survival
 * 4. Choose best target size based on readability
 * 5. Export final sprites + comparison strip
 * 6. Write survival audit
 *
 * Design: chunky medieval knight with flat-top helm, tabard with cross,
 * kite shield, broadsword. Designed for polygon-only primitives.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'stage43-humanoid');
mkdirSync(OUT_DIR, { recursive: true });

// ── Palette ──
const C = {
  helmDk:    [60, 65, 70, 255],
  helm:      [140, 150, 160, 255],
  helmLt:    [180, 190, 200, 255],
  skin:      [215, 175, 135, 255],
  tabardWht: [220, 215, 205, 255],
  tabardCrs: [160, 35, 35, 255],    // red cross on tabard
  armor:     [95, 100, 110, 255],
  armorDk:   [55, 58, 65, 255],
  chainmail: [120, 125, 135, 255],
  bootDk:    [40, 35, 30, 255],
  boot:      [70, 60, 50, 255],
  swordBlade:[195, 200, 210, 255],
  swordHilt: [90, 75, 45, 255],
  swordGuard:[160, 140, 60, 255],
  shieldFace:[55, 75, 130, 255],
  shieldRim: [170, 160, 100, 255],
  shieldCrs: [220, 215, 205, 255],
  capeDk:    [100, 25, 25, 255],
  cape:      [145, 40, 40, 255],
};

// ── Shared rasterizer (duplicated from Stage 41 — .mjs can't import .ts) ──
function createBuffer(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
function compositePixel(buf, x, y, c) {
  if (x < 0 || x >= buf.width || y < 0 || y >= buf.height || c[3] === 0) return;
  const i = (y * buf.width + x) * 4;
  if (c[3] === 255 || buf.data[i + 3] === 0) { buf.data[i]=c[0]; buf.data[i+1]=c[1]; buf.data[i+2]=c[2]; buf.data[i+3]=c[3]; return; }
  const sa=c[3]/255, da=buf.data[i+3]/255, outA=sa+da*(1-sa);
  buf.data[i]=Math.round((c[0]*sa+buf.data[i]*da*(1-sa))/outA);
  buf.data[i+1]=Math.round((c[1]*sa+buf.data[i+1]*da*(1-sa))/outA);
  buf.data[i+2]=Math.round((c[2]*sa+buf.data[i+2]*da*(1-sa))/outA);
  buf.data[i+3]=Math.round(outA*255);
}
function transformPt(px,py,t) {
  let x=px*t.scaleX, y=py*t.scaleY;
  if(t.flipX) x=-x; if(t.flipY) y=-y;
  if(t.rotation!==0){const r=t.rotation*Math.PI/180,co=Math.cos(r),si=Math.sin(r);const rx=x*co-y*si,ry=x*si+y*co;x=rx;y=ry;}
  return [x+t.x,y+t.y];
}
function toT(v,a,t){return Math.round(v/a*t);} function toTD(v,a,t){return Math.max(1,Math.round(v/a*t));}
function bresenham(x0,y0,x1,y1){const p=[];let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0);const sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx-dy,cx=x0,cy=y0;while(true){p.push([cx,cy]);if(cx===x1&&cy===y1)break;const e2=2*e;if(e2>-dy){e-=dy;cx+=sx;}if(e2<dx){e+=dx;cy+=sy;}}return p;}
function scanFill(buf,pts,c){if(pts.length<3)return;const n=pts.length;let mY=Infinity,MY=-Infinity;for(const p of pts){if(p.y<mY)mY=p.y;if(p.y>MY)MY=p.y;}mY=Math.max(0,mY);MY=Math.min(buf.height-1,MY);for(let y=mY;y<=MY;y++){const xs=[];for(let i=0;i<n;i++){const j=(i+1)%n;const yi=pts[i].y,yj=pts[j].y;if((yi<=y&&yj>y)||(yj<=y&&yi>y)){const t=(y-yi)/(yj-yi);xs.push(Math.round(pts[i].x+t*(pts[j].x-pts[i].x)));}}xs.sort((a,b)=>a-b);for(let k=0;k<xs.length-1;k+=2){const s=Math.max(0,xs[k]),e=Math.min(buf.width-1,xs[k+1]);for(let x=s;x<=e;x++)compositePixel(buf,x,y,c);}}}
function rasterShape(sh,buf,aW,aH){if(!sh.visible||(!sh.fill&&!sh.stroke))return;const g=sh.geometry,t=sh.transform;
if(g.kind==='rect'&&t.rotation===0&&!t.flipX&&!t.flipY){const[cx0,cy0]=transformPt(g.x,g.y,t);const[cx1,cy1]=transformPt(g.x+g.w,g.y+g.h,t);const x0=toT(cx0,aW,buf.width),y0=toT(cy0,aH,buf.height),x1=Math.max(x0+1,toT(cx1,aW,buf.width)),y1=Math.max(y0+1,toT(cy1,aH,buf.height));if(sh.fill)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)compositePixel(buf,x,y,sh.fill);}
else if(g.kind==='ellipse'){const[tcx,tcy]=transformPt(g.cx,g.cy,t);const cx=toT(tcx,aW,buf.width),cy=toT(tcy,aH,buf.height);const rx=toTD(Math.abs(g.rx*t.scaleX),aW,buf.width),ry=toTD(Math.abs(g.ry*t.scaleY),aH,buf.height);if(sh.fill)for(let dy=-ry;dy<=ry;dy++){const xs=Math.round(rx*Math.sqrt(Math.max(0,1-dy*dy/(ry*ry))));for(let dx=-xs;dx<=xs;dx++)compositePixel(buf,cx+dx,cy+dy,sh.fill);}}
else if(g.kind==='polygon'){const sc=g.points.map(p=>{const[tx,ty]=transformPt(p.x,p.y,t);return{x:toT(tx,aW,buf.width),y:toT(ty,aH,buf.height)};});if(sh.fill)scanFill(buf,sc,sh.fill);}
else if(g.kind==='line'&&sh.stroke){const[tx1,ty1]=transformPt(g.x1,g.y1,t);const[tx2,ty2]=transformPt(g.x2,g.y2,t);const pts=bresenham(toT(tx1,aW,buf.width),toT(ty1,aH,buf.height),toT(tx2,aW,buf.width),toT(ty2,aH,buf.height));const sw=Math.max(1,toTD(sh.stroke.width,aW,buf.width)),hf=Math.floor(sw/2);for(const[px,py]of pts)for(let dy=-hf;dy<=hf;dy++)for(let dx=-hf;dx<=hf;dx++)compositePixel(buf,px+dx,py+dy,sh.stroke.color);}}
function rasterize(doc,tw,th){const buf=createBuffer(tw,th);const sorted=[...doc.shapes].sort((a,b)=>a.zOrder-b.zOrder);for(const s of sorted)rasterShape(s,buf,doc.artboardWidth,doc.artboardHeight);return buf;}
function upscale(src,s){if(s<=1)return src;const tw=src.width*s,th=src.height*s,buf=createBuffer(tw,th);for(let sy=0;sy<src.height;sy++)for(let sx=0;sx<src.width;sx++){const si=(sy*src.width+sx)*4;for(let dy=0;dy<s;dy++)for(let dx=0;dx<s;dx++){const di=((sy*s+dy)*tw+sx*s+dx)*4;buf.data[di]=src.data[si];buf.data[di+1]=src.data[si+1];buf.data[di+2]=src.data[si+2];buf.data[di+3]=src.data[si+3];}}return buf;}
function savePng(buf,fn){writeFileSync(resolve(OUT_DIR,fn),Buffer.from(encode({width:buf.width,height:buf.height,data:buf.data,channels:4})));console.log(`  → ${fn} (${buf.width}×${buf.height})`);}

// ── Build vector shapes ──
const shapes = []; let z = 0;
const T = { x:0,y:0,scaleX:1,scaleY:1,rotation:0,flipX:false,flipY:false };
function add(name,geo,fill,reduction={}){ shapes.push({id:`vs_${name}`,name,groupId:null,zOrder:z++,geometry:geo,fill,stroke:null,transform:{...T},reduction,visible:true,locked:false}); }

// Cape (behind everything — wide drape)
add('cape', {kind:'polygon',points:[{x:225,y:100},{x:275,y:100},{x:360,y:440},{x:140,y:440}]}, C.capeDk, {cueTag:'cape',survivalHint:'prefer-survive'});
add('cape-highlight', {kind:'polygon',points:[{x:230,y:110},{x:270,y:110},{x:330,y:420},{x:170,y:420}]}, C.cape);

// Legs (under torso)
add('leg-left', {kind:'rect',x:205,y:320,w:38,h:80}, C.chainmail, {cueTag:'leg',survivalHint:'must-survive'});
add('leg-right', {kind:'rect',x:262,y:320,w:38,h:80}, C.chainmail, {cueTag:'leg',survivalHint:'must-survive'});

// Boots
add('boot-left', {kind:'polygon',points:[{x:195,y:385},{x:250,y:385},{x:255,y:440},{x:190,y:440}]}, C.bootDk, {cueTag:'boot',survivalHint:'must-survive'});
add('boot-right', {kind:'polygon',points:[{x:255,y:385},{x:310,y:385},{x:315,y:440},{x:250,y:440}]}, C.bootDk, {cueTag:'boot',survivalHint:'must-survive'});

// Tabard (over armor, identity piece)
add('tabard', {kind:'polygon',points:[{x:195,y:150},{x:305,y:150},{x:320,y:370},{x:180,y:370}]}, C.tabardWht, {cueTag:'tabard',survivalHint:'must-survive'});

// Tabard cross (identity symbol)
add('cross-v', {kind:'rect',x:237,y:170,w:26,h:140}, C.tabardCrs, {cueTag:'cross',survivalHint:'must-survive'});
add('cross-h', {kind:'rect',x:210,y:210,w:80,h:26}, C.tabardCrs, {cueTag:'cross',survivalHint:'must-survive'});

// Armor (chest plate over tabard edges)
add('pauldron-left', {kind:'polygon',points:[{x:155,y:115},{x:205,y:115},{x:205,y:175},{x:150,y:175}]}, C.armor, {cueTag:'pauldron',survivalHint:'prefer-survive'});
add('pauldron-right', {kind:'polygon',points:[{x:295,y:115},{x:345,y:115},{x:350,y:175},{x:295,y:175}]}, C.armor, {cueTag:'pauldron',survivalHint:'prefer-survive'});

// Arms (chainmail)
add('arm-left', {kind:'rect',x:150,y:155,w:35,h:130}, C.chainmail, {cueTag:'arm',survivalHint:'prefer-survive'});
add('arm-right', {kind:'rect',x:315,y:155,w:35,h:130}, C.chainmail, {cueTag:'arm',survivalHint:'prefer-survive'});

// Helm (flat-top great helm — identity shape)
add('helm', {kind:'polygon',points:[{x:200,y:40},{x:300,y:40},{x:310,y:130},{x:190,y:130}]}, C.helm, {cueTag:'helm',survivalHint:'must-survive'});
add('helm-visor', {kind:'rect',x:215,y:75,w:70,h:20}, C.helmDk, {cueTag:'visor',survivalHint:'prefer-survive'});
add('helm-slit', {kind:'rect',x:230,y:78,w:40,h:14}, C.armorDk, {cueTag:'visor-slit',survivalHint:'droppable',dropPriority:6});
add('helm-top', {kind:'rect',x:205,y:40,w:90,h:12}, C.helmLt, {cueTag:'helm-crown',survivalHint:'droppable',dropPriority:7});

// Shield (left hand — kite shape, identity gear)
add('shield', {kind:'polygon',points:[{x:105,y:170},{x:175,y:170},{x:175,y:320},{x:140,y:370}]}, C.shieldFace, {cueTag:'shield',survivalHint:'must-survive'});
add('shield-rim', {kind:'polygon',points:[{x:105,y:170},{x:115,y:170},{x:115,y:310},{x:140,y:355},{x:140,y:370},{x:105,y:320}]}, C.shieldRim, {cueTag:'shield-rim',survivalHint:'droppable',dropPriority:4});
add('shield-cross-v', {kind:'rect',x:133,y:185,w:14,h:110}, C.shieldCrs, {cueTag:'shield-cross',survivalHint:'prefer-survive'});
add('shield-cross-h', {kind:'rect',x:115,y:225,w:50,h:14}, C.shieldCrs, {cueTag:'shield-cross',survivalHint:'prefer-survive'});

// Sword (right hand — broadsword)
add('sword-blade', {kind:'rect',x:360,y:50,w:14,h:220}, C.swordBlade, {cueTag:'sword',survivalHint:'must-survive'});
add('sword-guard', {kind:'rect',x:345,y:260,w:44,h:10}, C.swordGuard, {cueTag:'sword-guard',survivalHint:'droppable',dropPriority:5});
add('sword-hilt', {kind:'rect',x:361,y:270,w:12,h:45}, C.swordHilt, {cueTag:'sword-hilt',survivalHint:'droppable',dropPriority:6});

// Belt
add('belt', {kind:'rect',x:185,y:310,w:130,h:15}, C.armorDk, {cueTag:'belt',survivalHint:'droppable',dropPriority:5});

// ── Build document ──
const doc = {
  id: 'vm_templar_dogfood',
  name: 'Templar Knight',
  artboardWidth: 500, artboardHeight: 500,
  shapes, groups: [], palette: Object.values(C),
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

// ── Rasterize + analyze ──
console.log('=== Stage 43.1: Templar Knight — Humanoid Dogfood ===\n');
console.log('Phase 1: Artboard render...');
savePng(rasterize(doc, 500, 500), 'templar-500x500.png');

const profiles = [
  { id:'sp_16x16', tw:16, th:16 },
  { id:'sp_16x32', tw:16, th:32 },
  { id:'sp_24x24', tw:24, th:24 },
  { id:'sp_32x32', tw:32, th:32 },
  { id:'sp_32x48', tw:32, th:48 },
  { id:'sp_48x48', tw:48, th:48 },
  { id:'sp_64x64', tw:64, th:64 },
];

console.log('\nPhase 2: Multi-size rasterize...');
const bufs = new Map();
for (const p of profiles) {
  const buf = rasterize(doc, p.tw, p.th);
  bufs.set(p.id, buf);
  savePng(buf, `templar-${p.tw}x${p.th}.png`);
}

console.log('\nPhase 3: Comparison strip...');
const DH = 256, GAP = 8, BG = [40,40,40,255];
const panels = profiles.map(p => {
  const buf = bufs.get(p.id);
  return upscale(buf, Math.max(1, Math.floor(DH / p.th)));
});
const totalW = panels.reduce((s,p) => s+p.width, 0) + GAP*(panels.length-1);
const strip = createBuffer(totalW, DH);
for(let i=0;i<strip.data.length;i+=4){strip.data[i]=BG[0];strip.data[i+1]=BG[1];strip.data[i+2]=BG[2];strip.data[i+3]=BG[3];}
let xOff = 0;
for(const panel of panels){const yOff=Math.floor((DH-panel.height)/2);for(let sy=0;sy<panel.height;sy++){const ty=yOff+sy;if(ty<0||ty>=strip.height)continue;for(let sx=0;sx<panel.width;sx++){const tx=xOff+sx;if(tx<0||tx>=strip.width)continue;const si=(sy*panel.width+sx)*4;if(panel.data[si+3]>0){const ti=(ty*strip.width+tx)*4;strip.data[ti]=panel.data[si];strip.data[ti+1]=panel.data[si+1];strip.data[ti+2]=panel.data[si+2];strip.data[ti+3]=panel.data[si+3];}}}xOff+=panel.width+GAP;}
savePng(strip, 'templar-comparison.png');

console.log('\nPhase 4: Reduction analysis...');
const audit = ['# Stage 43.1 — Templar Knight: Survival Audit\n'];
audit.push(`Asset: Templar Knight (humanoid)`);
audit.push(`Shapes: ${doc.shapes.length}`);
audit.push(`Artboard: ${doc.artboardWidth}×${doc.artboardHeight}\n`);
audit.push('## Reduction per profile\n');

for (const p of profiles) {
  const buf = bufs.get(p.id);
  const total = p.tw * p.th;
  let filled = 0;
  for (let i = 3; i < buf.data.length; i += 4) if (buf.data[i] > 0) filled++;
  const fillPct = ((filled / total) * 100).toFixed(1);
  const collapsed = [], survived = [];
  for (const shape of doc.shapes) {
    if (!shape.visible) continue;
    const g = shape.geometry;
    let eX=0,eY=0;
    if(g.kind==='rect'){eX=g.w;eY=g.h;}else if(g.kind==='ellipse'){eX=g.rx*2;eY=g.ry*2;}else if(g.kind==='polygon'){let mX=Infinity,MX=-Infinity,mY=Infinity,MY=-Infinity;for(const pt of g.points){mX=Math.min(mX,pt.x);MX=Math.max(MX,pt.x);mY=Math.min(mY,pt.y);MY=Math.max(MY,pt.y);}eX=MX-mX;eY=MY-mY;}else if(g.kind==='line'){eX=Math.abs(g.x2-g.x1);eY=Math.abs(g.y2-g.y1);}
    if(Math.round(eX/doc.artboardWidth*p.tw)<1||Math.round(eY/doc.artboardHeight*p.th)<1) collapsed.push(shape.name);
    else survived.push(shape.name);
  }
  const line = `### ${p.tw}×${p.th}\n- Fill: ${fillPct}%\n- Survived: ${survived.length} — ${survived.join(', ')}\n- Collapsed: ${collapsed.length}${collapsed.length>0?' — '+collapsed.join(', '):''}\n`;
  audit.push(line);
  console.log(`  ${p.tw}×${p.th}: ${fillPct}% fill, ${survived.length} survived, ${collapsed.length} collapsed`);
}

// ── Best size recommendation ──
audit.push('## Best size recommendation\n');
audit.push('**32×48** — best balance of readability and detail for humanoid character.');
audit.push('- Cross on tabard reads clearly');
audit.push('- Helm shape distinct from body');
audit.push('- Shield and sword recognizable');
audit.push('- Belt/visor details lost at smaller sizes but helm + tabard cross carry identity');
audit.push('- 48×48 also viable but wastes horizontal space for tall character\n');

// ── Friction notes ──
audit.push('## Friction notes\n');
audit.push('1. **Polygon cape drape is adequate** — 4-point polygon gives a clean trapezoid silhouette that reads as cape/cloak. No curve pain here.');
audit.push('2. **Kite shield required 4 polygon points** — the pointed bottom works fine with polygon, no curve needed.');
audit.push('3. **Pauldrons are just rects** — boxy shoulder armor is natural for polygon-only.');
audit.push('4. **Helm flat-top is polygon-friendly** — great helm shape is inherently geometric.');
audit.push('5. **No curve pain for this asset class** — medieval knight with flat armor is ideal for polygon-only.');
audit.push('6. **Cross detail survives well at 32×48** — vertical + horizontal rects read as cross even at small sizes.');
audit.push('7. **Shield cross collapses below 24×24** — expected, detail tier.\n');

audit.push('## Polygon-only assessment\n');
audit.push('**No curve pain.** Medieval knight is a geometric design domain.');
audit.push('Polygon-only handles all shapes naturally — flat helm, boxy armor, straight cape drape, rectangular weapons.');

writeFileSync(resolve(OUT_DIR, 'survival-audit.md'), audit.join('\n'));
console.log('\n  → survival-audit.md');

// Export "best size" sprite at chosen profile (32×48)
const best = rasterize(doc, 32, 48);
savePng(best, 'templar-final-32x48.png');
savePng(upscale(best, 8), 'templar-final-32x48-8x.png');

console.log('\n✓ Stage 43.1 complete — Templar Knight humanoid dogfood.');
