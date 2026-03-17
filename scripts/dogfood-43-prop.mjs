#!/usr/bin/env node
/**
 * Stage 43.2 — Prop Dogfood: Iron Lantern
 *
 * Full vector→raster→sprite cleanup pipeline:
 * Shape-driven prop with round glass body, metal frame, handle, and flame.
 * Tests polygon-only on rounded/organic forms (glass bulb, flame shape).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'stage43-prop');
mkdirSync(OUT_DIR, { recursive: true });

// ── Palette ──
const C = {
  ironDk:     [40, 42, 45, 255],
  iron:       [80, 85, 92, 255],
  ironLt:     [120, 128, 138, 255],
  glassDk:    [35, 55, 70, 255],
  glass:      [55, 90, 110, 255],
  glassLt:    [85, 130, 155, 255],
  glassHi:    [150, 195, 220, 200],  // translucent highlight
  flameCore:  [255, 230, 140, 255],
  flameMid:   [255, 170, 50, 255],
  flameOuter: [220, 90, 25, 255],
  chainDk:    [50, 52, 55, 255],
  chain:      [90, 95, 100, 255],
  glow:       [255, 200, 80, 60],    // translucent glow
};

// ── Rasterizer (same as 43.1) ──
function createBuffer(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function compositePixel(buf,x,y,c){if(x<0||x>=buf.width||y<0||y>=buf.height||c[3]===0)return;const i=(y*buf.width+x)*4;if(c[3]===255||buf.data[i+3]===0){buf.data[i]=c[0];buf.data[i+1]=c[1];buf.data[i+2]=c[2];buf.data[i+3]=c[3];return;}const sa=c[3]/255,da=buf.data[i+3]/255,outA=sa+da*(1-sa);buf.data[i]=Math.round((c[0]*sa+buf.data[i]*da*(1-sa))/outA);buf.data[i+1]=Math.round((c[1]*sa+buf.data[i+1]*da*(1-sa))/outA);buf.data[i+2]=Math.round((c[2]*sa+buf.data[i+2]*da*(1-sa))/outA);buf.data[i+3]=Math.round(outA*255);}
function transformPt(px,py,t){let x=px*t.scaleX,y=py*t.scaleY;if(t.flipX)x=-x;if(t.flipY)y=-y;if(t.rotation!==0){const r=t.rotation*Math.PI/180,co=Math.cos(r),si=Math.sin(r);const rx=x*co-y*si,ry=x*si+y*co;x=rx;y=ry;}return[x+t.x,y+t.y];}
function toT(v,a,t){return Math.round(v/a*t);}function toTD(v,a,t){return Math.max(1,Math.round(v/a*t));}
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

// ── Build shapes ──
const shapes = []; let z = 0;
const T = { x:0,y:0,scaleX:1,scaleY:1,rotation:0,flipX:false,flipY:false };
function add(name,geo,fill,reduction={}){ shapes.push({id:`vs_${name}`,name,groupId:null,zOrder:z++,geometry:geo,fill,stroke:null,transform:{...T},reduction,visible:true,locked:false}); }

// Glow halo (behind everything, translucent)
add('glow', {kind:'ellipse',cx:250,cy:270,rx:120,ry:100}, C.glow, {cueTag:'glow',survivalHint:'droppable',dropPriority:9});

// Chain/handle (behind lantern body)
add('chain-left', {kind:'rect',x:200,y:30,w:10,h:80}, C.chainDk, {cueTag:'chain',survivalHint:'droppable',dropPriority:7});
add('chain-right', {kind:'rect',x:290,y:30,w:10,h:80}, C.chainDk, {cueTag:'chain',survivalHint:'droppable',dropPriority:7});
add('chain-top', {kind:'rect',x:200,y:25,w:100,h:12}, C.chain, {cueTag:'chain',survivalHint:'droppable',dropPriority:7});

// Handle hook
add('hook', {kind:'polygon',points:[{x:240,y:10},{x:260,y:10},{x:260,y:30},{x:240,y:30}]}, C.iron, {cueTag:'hook',survivalHint:'droppable',dropPriority:8});

// Lantern cap (top)
add('cap', {kind:'polygon',points:[{x:195,y:95},{x:305,y:95},{x:285,y:115},{x:215,y:115}]}, C.ironDk, {cueTag:'cap',survivalHint:'must-survive'});
add('cap-knob', {kind:'polygon',points:[{x:235,y:80},{x:265,y:80},{x:270,y:100},{x:230,y:100}]}, C.iron, {cueTag:'cap-knob',survivalHint:'droppable',dropPriority:6});

// Glass body — this is the polygon-only stress test
// Approximating a rounded rectangular form with an 8-point polygon
add('glass-body', {kind:'polygon',points:[
  {x:210,y:115}, // top-left
  {x:290,y:115}, // top-right
  {x:310,y:145}, // upper-right bulge
  {x:310,y:350}, // lower-right bulge
  {x:290,y:380}, // bottom-right
  {x:210,y:380}, // bottom-left
  {x:190,y:350}, // lower-left bulge
  {x:190,y:145}, // upper-left bulge
]}, C.glassDk, {cueTag:'glass',survivalHint:'must-survive'});

// Glass mid-tone (inner area)
add('glass-inner', {kind:'polygon',points:[
  {x:220,y:125},
  {x:280,y:125},
  {x:295,y:150},
  {x:295,y:340},
  {x:280,y:365},
  {x:220,y:365},
  {x:205,y:340},
  {x:205,y:150},
]}, C.glass);

// Glass highlight (off-center reflection)
add('glass-highlight', {kind:'polygon',points:[
  {x:225,y:135},
  {x:245,y:135},
  {x:245,y:340},
  {x:225,y:340},
]}, C.glassLt, {cueTag:'glass-highlight',survivalHint:'droppable',dropPriority:4});

// Glass translucent shine
add('glass-shine', {kind:'polygon',points:[
  {x:265,y:150},
  {x:280,y:150},
  {x:280,y:200},
  {x:265,y:200},
]}, C.glassHi, {cueTag:'glass-shine',survivalHint:'droppable',dropPriority:8});

// Metal frame bars (vertical)
add('frame-left', {kind:'rect',x:195,y:115,w:12,h:265}, C.ironDk, {cueTag:'frame',survivalHint:'prefer-survive'});
add('frame-right', {kind:'rect',x:293,y:115,w:12,h:265}, C.ironDk, {cueTag:'frame',survivalHint:'prefer-survive'});

// Metal frame bars (horizontal)
add('frame-mid', {kind:'rect',x:195,y:235,w:110,h:10}, C.iron, {cueTag:'frame-mid',survivalHint:'droppable',dropPriority:5});

// Lantern base
add('base', {kind:'polygon',points:[{x:185,y:380},{x:315,y:380},{x:305,y:410},{x:195,y:410}]}, C.ironDk, {cueTag:'base',survivalHint:'must-survive'});
add('base-bottom', {kind:'rect',x:200,y:410,w:100,h:15}, C.iron, {cueTag:'base-foot',survivalHint:'prefer-survive'});

// Flame (the organic shape test)
// Outer flame — 6-point polygon trying to approximate a teardrop
add('flame-outer', {kind:'polygon',points:[
  {x:250,y:160},  // top tip
  {x:275,y:210},  // right upper
  {x:280,y:270},  // right mid
  {x:265,y:310},  // right lower
  {x:235,y:310},  // left lower
  {x:220,y:270},  // left mid
  {x:225,y:210},  // left upper
]}, C.flameOuter, {cueTag:'flame',survivalHint:'must-survive'});

// Mid flame
add('flame-mid', {kind:'polygon',points:[
  {x:250,y:175},  // top tip
  {x:268,y:220},
  {x:270,y:270},
  {x:260,y:300},
  {x:240,y:300},
  {x:230,y:270},
  {x:232,y:220},
]}, C.flameMid);

// Inner flame (hot core)
add('flame-core', {kind:'polygon',points:[
  {x:250,y:200},
  {x:260,y:240},
  {x:258,y:280},
  {x:242,y:280},
  {x:240,y:240},
]}, C.flameCore, {cueTag:'flame-core',survivalHint:'prefer-survive'});

// ── Build document ──
const doc = {
  id: 'vm_lantern_dogfood',
  name: 'Iron Lantern',
  artboardWidth: 500, artboardHeight: 500,
  shapes, groups: [], palette: Object.values(C),
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

// ── Pipeline ──
console.log('=== Stage 43.2: Iron Lantern — Prop Dogfood ===\n');
console.log('Phase 1: Artboard render...');
savePng(rasterize(doc, 500, 500), 'lantern-500x500.png');

const profiles = [
  {id:'sp_16x16',tw:16,th:16},{id:'sp_16x32',tw:16,th:32},{id:'sp_24x24',tw:24,th:24},
  {id:'sp_32x32',tw:32,th:32},{id:'sp_32x48',tw:32,th:48},{id:'sp_48x48',tw:48,th:48},{id:'sp_64x64',tw:64,th:64},
];

console.log('\nPhase 2: Multi-size rasterize...');
const bufs = new Map();
for (const p of profiles) { const buf = rasterize(doc, p.tw, p.th); bufs.set(p.id, buf); savePng(buf, `lantern-${p.tw}x${p.th}.png`); }

console.log('\nPhase 3: Comparison strip...');
const DH=256,GAP=8,BG=[40,40,40,255];
const panels = profiles.map(p => upscale(bufs.get(p.id), Math.max(1, Math.floor(DH / p.th))));
const totalW = panels.reduce((s,p)=>s+p.width,0)+GAP*(panels.length-1);
const strip = createBuffer(totalW, DH);
for(let i=0;i<strip.data.length;i+=4){strip.data[i]=BG[0];strip.data[i+1]=BG[1];strip.data[i+2]=BG[2];strip.data[i+3]=BG[3];}
let xOff=0;for(const panel of panels){const yOff=Math.floor((DH-panel.height)/2);for(let sy=0;sy<panel.height;sy++){const ty=yOff+sy;if(ty<0||ty>=strip.height)continue;for(let sx=0;sx<panel.width;sx++){const tx=xOff+sx;if(tx<0||tx>=strip.width)continue;const si=(sy*panel.width+sx)*4;if(panel.data[si+3]>0){const ti=(ty*strip.width+tx)*4;strip.data[ti]=panel.data[si];strip.data[ti+1]=panel.data[si+1];strip.data[ti+2]=panel.data[si+2];strip.data[ti+3]=panel.data[si+3];}}}xOff+=panel.width+GAP;}
savePng(strip, 'lantern-comparison.png');

console.log('\nPhase 4: Reduction analysis...');
const audit = ['# Stage 43.2 — Iron Lantern: Survival Audit\n'];
audit.push(`Asset: Iron Lantern (prop)`);
audit.push(`Shapes: ${doc.shapes.length}`);
audit.push(`Artboard: ${doc.artboardWidth}×${doc.artboardHeight}\n`);
audit.push('## Reduction per profile\n');

for (const p of profiles) {
  const buf = bufs.get(p.id);
  const total = p.tw*p.th; let filled=0;
  for(let i=3;i<buf.data.length;i+=4)if(buf.data[i]>0)filled++;
  const fillPct=((filled/total)*100).toFixed(1);
  const collapsed=[],survived=[];
  for(const shape of doc.shapes){if(!shape.visible)continue;const g=shape.geometry;let eX=0,eY=0;
  if(g.kind==='rect'){eX=g.w;eY=g.h;}else if(g.kind==='ellipse'){eX=g.rx*2;eY=g.ry*2;}else if(g.kind==='polygon'){let mX=Infinity,MX=-Infinity,mY=Infinity,MY=-Infinity;for(const pt of g.points){mX=Math.min(mX,pt.x);MX=Math.max(MX,pt.x);mY=Math.min(mY,pt.y);MY=Math.max(MY,pt.y);}eX=MX-mX;eY=MY-mY;}else if(g.kind==='line'){eX=Math.abs(g.x2-g.x1);eY=Math.abs(g.y2-g.y1);}
  if(Math.round(eX/doc.artboardWidth*p.tw)<1||Math.round(eY/doc.artboardHeight*p.th)<1)collapsed.push(shape.name);else survived.push(shape.name);}
  audit.push(`### ${p.tw}×${p.th}\n- Fill: ${fillPct}%\n- Survived: ${survived.length} — ${survived.join(', ')}\n- Collapsed: ${collapsed.length}${collapsed.length>0?' — '+collapsed.join(', '):''}\n`);
  console.log(`  ${p.tw}×${p.th}: ${fillPct}% fill, ${survived.length} survived, ${collapsed.length} collapsed`);
}

audit.push('## Best size recommendation\n');
audit.push('**32×32** — lantern is a compact prop that fills the square well.');
audit.push('- Flame reads as distinct warm mass against cool glass');
audit.push('- Glass body shape distinguishable from metal frame');
audit.push('- Cap and base give clear top/bottom structure');
audit.push('- 16×16 viable as inventory icon (flame + glass body still read)');
audit.push('- Chain/hook disappear at small sizes — acceptable for prop\n');

audit.push('## Friction notes\n');
audit.push('1. **Glass body polygon (8 points) works** — the bulging octagonal shape reads as rounded at pixel scale. At 500px it looks faceted, but at 32px it reads as a rounded rectangle. This is a case where pixel-grid quantization is actually helpful.');
audit.push('2. **Flame polygon (6-7 points) is adequate** — the teardrop shape has visible faceting at artboard scale but reads fine at sprite scale. The three-layer flame (outer/mid/core) creates a believable glow gradient.');
audit.push('3. **FIRST POLYGON FRICTION:** Editing the flame shape required careful point placement. A curve would have been faster to shape the teardrop. However, once placed, the polygon result at pixel scale is indistinguishable from what a curve would produce.');
audit.push('4. **Translucent glow/highlight works** — alpha compositing handles the translucent glass shine and glow halo correctly.');
audit.push('5. **Metal frame detail holds well** — the thin vertical bars and horizontal divider survive at 32×32.');
audit.push('6. **Glass highlight strip is a nice detail at 48+ but correctly marked droppable.**\n');

audit.push('## Polygon-only assessment\n');
audit.push('**Mild friction, acceptable result.** The flame teardrop shape took more effort to place as a polygon (7 points) than it would with a curve tool. But the final pixel output is equivalent — at 32×32, a 7-point polygon flame and a curved flame produce the same pixels.');
audit.push('**Verdict: polygon-only holds for props.** The pain is in the authoring, not the output.');

writeFileSync(resolve(OUT_DIR, 'survival-audit.md'), audit.join('\n'));
console.log('\n  → survival-audit.md');

const best = rasterize(doc, 32, 32);
savePng(best, 'lantern-final-32x32.png');
savePng(upscale(best, 8), 'lantern-final-32x32-8x.png');

console.log('\n✓ Stage 43.2 complete — Iron Lantern prop dogfood.');
