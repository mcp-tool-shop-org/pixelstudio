#!/usr/bin/env node
/**
 * Quick test of 47A improved prompts — Shadow Monk only.
 * Compares against the Stage 47 blind-generation baseline.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT = resolve(__dirname, '..', 'docs', 'showcase', 'stage47a-test');
mkdirSync(OUT, { recursive: true });

const OLLAMA = 'http://localhost:11434';
const MODEL = 'qwen2.5:14b';

// ── Minimal rasterizer ──
function createBuffer(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function px(buf,x,y,c){if(x<0||x>=buf.width||y<0||y>=buf.height||c[3]===0)return;const i=(y*buf.width+x)*4;buf.data[i]=c[0];buf.data[i+1]=c[1];buf.data[i+2]=c[2];buf.data[i+3]=c[3];}
function t(v,art,tgt){return Math.round((v/art)*tgt);}
function scanFill(buf,pts,c){if(pts.length<3)return;let minY=1e9,maxY=-1e9;for(const p of pts){if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}minY=Math.max(0,minY);maxY=Math.min(buf.height-1,maxY);for(let y=minY;y<=maxY;y++){const xs=[];for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;const yi=pts[i].y,yj=pts[j].y;if((yi<=y&&yj>y)||(yj<=y&&yi>y))xs.push(Math.round(pts[i].x+(y-yi)/(yj-yi)*(pts[j].x-pts[i].x)));}xs.sort((a,b)=>a-b);for(let k=0;k<xs.length-1;k+=2){for(let x=Math.max(0,xs[k]);x<=Math.min(buf.width-1,xs[k+1]);x++)px(buf,x,y,c);}}}

function rasterize(shapes, aw, ah, tw, th) {
  const buf = createBuffer(tw, th);
  for (const s of shapes) {
    const f = s.fill; if (!f) continue;
    switch (s.type) {
      case 'rect': {
        const x0=t(s.x,aw,tw),y0=t(s.y,ah,th),x1=Math.max(x0+1,t(s.x+s.w,aw,tw)),y1=Math.max(y0+1,t(s.y+s.h,ah,th));
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)px(buf,x,y,f); break;
      }
      case 'ellipse': {
        const cx=t(s.cx,aw,tw),cy=t(s.cy,ah,th),rx=Math.max(1,Math.round(Math.abs(s.rx/aw)*tw)),ry=Math.max(1,Math.round(Math.abs(s.ry/ah)*th));
        for(let dy=-ry;dy<=ry;dy++){const xs=Math.round(rx*Math.sqrt(Math.max(0,1-(dy*dy)/(ry*ry))));for(let dx=-xs;dx<=xs;dx++)px(buf,cx+dx,cy+dy,f);} break;
      }
      case 'polygon': {
        if(!s.points||s.points.length<3)break;
        scanFill(buf,s.points.map(p=>({x:t(p.x,aw,tw),y:t(p.y,ah,th)})),f); break;
      }
    }
  }
  return buf;
}

function upscale(buf,f){const o=createBuffer(buf.width*f,buf.height*f);for(let y=0;y<buf.height;y++)for(let x=0;x<buf.width;x++){const i=(y*buf.width+x)*4;for(let dy=0;dy<f;dy++)for(let dx=0;dx<f;dx++){const j=((y*f+dy)*(buf.width*f)+(x*f+dx))*4;o.data[j]=buf.data[i];o.data[j+1]=buf.data[i+1];o.data[j+2]=buf.data[i+2];o.data[j+3]=buf.data[i+3];}}return o;}
function savePng(buf,path){writeFileSync(path,Buffer.from(encode({width:buf.width,height:buf.height,data:buf.data,channels:4,depth:8})));}
function fillPct(buf){let c=0;for(let i=3;i<buf.data.length;i+=4)if(buf.data[i]>0)c++;return(c/(buf.width*buf.height)*100).toFixed(1);}

// ── The improved prompt (matches 47A code) ──
const palette = {
  primary: [40,30,60,255], secondary: [70,50,90,255], accent: [220,180,50,255],
  skin: [200,160,130,255], shadow: [20,15,30,255], highlight: [100,200,220,255],
};

const prompt = `You are a 2D pixel art sprite designer. You output vector shapes as JSON.

TASK: Design "A hooded monk holding a tall staff. Wide robe, dark hood covering the face, visible belt/sash, glowing staff orb on top. The silhouette should read as robed wizard/monk with staff even at 16x16." on a 500x500 artboard.
Target render sizes: 16x, 32x, 48x, 64x pixels. Must read clearly at 16x16.

SPATIAL LAYOUT GRID (500x500 artboard):
- Top zone (head/hat): y = 25 to 150
- Upper zone (shoulders/chest): y = 125 to 225
- Middle zone (torso/arms): y = 200 to 325
- Lower zone (waist/hips): y = 300 to 375
- Bottom zone (legs/feet): y = 350 to 475
- Center x = 250, character should span x = 125 to 375
- Weapon/accessory: offset to LEFT or RIGHT side (x < 125 or x > 375)

PROPORTION RULES:
- Head: 75-100px tall (15-20% of height) — LARGE head reads well small
- Shoulders: 125-175px wide (wider than head!)
- Body width: 100-140px
- Arms: MUST have 15-30px GAP between arm and body
- Legs: MUST have 10-20px GAP between legs
- Total height: 300-425px (leave padding top and bottom)

OVERLAP RULES (CRITICAL):
- Shapes that represent different body parts must NOT overlap
- Arms must be NEXT TO the body, not ON TOP of it
- Head sits ABOVE the body, not inside it
- If two shapes share the same area, they will merge visually — this is BAD
- Weapon/staff should be BESIDE the character, not behind it
- EXCEPTION: shadow/highlight shapes CAN overlap their parent (for shading)

COLOR PALETTE (use these colors, do NOT invent random colors):
- Primary (body/main mass): [40,30,60,255]
- Secondary (clothing/armor/scales): [70,50,90,255]
- Accent (weapon/magic/eyes/important details): [220,180,50,255]
- Skin/Light areas (face/hands/belly): [200,160,130,255]
- Shadow (dark sides/under areas): [20,15,30,255]
- Highlight (glow/rim light/tips): [100,200,220,255]

SHAPE TYPES (use rect and ellipse primarily, polygon for pointed shapes):
- rect: {"type":"rect","x":N,"y":N,"w":N,"h":N} — body, limbs, weapons
- ellipse: {"type":"ellipse","cx":N,"cy":N,"rx":N,"ry":N} — heads, shoulders, shields
- polygon: {"type":"polygon","points":[{"x":N,"y":N}...],"closed":true} — hats, wings, tails (3-6 points)

FILL: [R,G,B,255] — always full opacity

SIZE RULES:
- Minimum width or height for ANY shape: 30px
- Shapes smaller than 30px will vanish at 16x16 — do not create them

EXAMPLE of a GOOD sprite (knight with sword, 12 shapes):
{"shapes":[
  {"name":"body","type":"rect","x":190,"y":180,"w":120,"h":180,"fill":[50,80,160,255],"mustSurvive":true},
  {"name":"head","type":"ellipse","cx":250,"cy":150,"rx":50,"ry":45,"fill":[220,180,150,255],"mustSurvive":true},
  {"name":"helmet","type":"polygon","points":[{"x":200,"y":130},{"x":250,"y":80},{"x":300,"y":130}],"fill":[160,160,170,255],"mustSurvive":true},
  {"name":"left-shoulder","type":"ellipse","cx":175,"cy":200,"rx":35,"ry":25,"fill":[60,90,170,255]},
  {"name":"right-shoulder","type":"ellipse","cx":325,"cy":200,"rx":35,"ry":25,"fill":[60,90,170,255]},
  {"name":"left-arm","type":"rect","x":150,"y":220,"w":30,"h":100,"fill":[50,70,150,255]},
  {"name":"right-arm","type":"rect","x":320,"y":220,"w":30,"h":100,"fill":[50,70,150,255]},
  {"name":"sword","type":"rect","x":355,"y":120,"w":16,"h":200,"fill":[200,200,210,255],"mustSurvive":true},
  {"name":"sword-hilt","type":"rect","x":340,"y":300,"w":46,"h":20,"fill":[180,140,60,255]},
  {"name":"belt","type":"rect","x":190,"y":280,"w":120,"h":20,"fill":[180,140,60,255]},
  {"name":"left-leg","type":"rect","x":195,"y":360,"w":45,"h":100,"fill":[40,60,130,255]},
  {"name":"right-leg","type":"rect","x":260,"y":360,"w":45,"h":100,"fill":[40,60,130,255]}
]}
Notice: head is ABOVE body, shoulders WIDER than body, arms SEPARATED from torso with gaps, legs SEPARATED from each other, sword is to the RIGHT side away from body, colors have HIGH CONTRAST (light head vs dark body, gold belt vs blue armor).

RETURN ONLY valid JSON. No markdown fences. No explanation outside the JSON object.
{"reasoning":"...","shapes":[...]}`;

console.log('Calling qwen2.5:14b with improved prompt...');
const start = Date.now();
const res = await fetch(OLLAMA + '/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.7, num_predict: 4096 } }),
});
const json = await res.json();
const raw = json.response?.trim() ?? '';
console.log(`Response in ${Date.now() - start}ms`);

// Parse JSON
let parsed;
try { parsed = JSON.parse(raw); } catch {
  const f = raw.indexOf('{'), l = raw.lastIndexOf('}');
  if (f !== -1 && l > f) try { parsed = JSON.parse(raw.slice(f, l+1)); } catch(e) { console.log('PARSE FAIL'); console.log(raw.slice(0,500)); process.exit(1); }
}

if (!parsed?.shapes) { console.log('No shapes'); console.log(raw.slice(0,500)); process.exit(1); }

const shapes = parsed.shapes.filter(s => s.name && s.type && s.fill?.length === 4);
console.log(`Shapes: ${shapes.length}`);
console.log(`Reasoning: ${parsed.reasoning}`);
console.log();

for (const s of shapes) {
  const d = s.type==='rect'?`${s.w}x${s.h} @(${s.x},${s.y})`:s.type==='ellipse'?`rx${s.rx} ry${s.ry} @(${s.cx},${s.cy})`:s.points?.length+'pts';
  console.log(`  ${s.name} (${s.type}, ${d}) fill=[${s.fill}]${s.mustSurvive?' MUST':''}`);
}

console.log('\nRasterization:');
for (const sz of [16, 24, 32, 48, 64]) {
  const buf = rasterize(shapes, 500, 500, sz, sz);
  console.log(`  ${sz}x${sz}: ${fillPct(buf)}% fill`);
  const scale = Math.ceil(256/sz);
  savePng(upscale(buf, scale), resolve(OUT, `monk-47a---${sz}x${sz}.png`));
}

writeFileSync(resolve(OUT, 'shapes.json'), JSON.stringify(parsed, null, 2));
console.log(`\nOutput: ${OUT}`);
