// Dependency-free PNG radar for email inline attachments.
const zlib = require('node:zlib');
module.exports = function radarPng(domains) {
  const W=640,H=520,cx=320,cy=255,r=180, pixels=Buffer.alloc(W*H*3);
  const bg=[246,242,233],grid=[204,201,192],gold=[184,140,46],ink=[13,27,42];
  for(let i=0;i<pixels.length;i+=3)bg.forEach((v,k)=>pixels[i+k]=v);
  function pixel(x,y,color){x=Math.round(x);y=Math.round(y);if(x>=0&&x<W&&y>=0&&y<H)for(let k=0;k<3;k++)pixels[(y*W+x)*3+k]=color[k];}
  function line(a,b,color,width=1){const steps=Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])));for(let i=0;i<=steps;i++){const t=steps?i/steps:0;for(let dx=-Math.floor(width/2);dx<=Math.floor(width/2);dx++)for(let dy=-Math.floor(width/2);dy<=Math.floor(width/2);dy++)pixel(a[0]+(b[0]-a[0])*t+dx,a[1]+(b[1]-a[1])*t+dy,color);}}
  const n=domains.length,point=(i,scale)=>[cx+Math.sin(i*2*Math.PI/n)*r*scale,cy-Math.cos(i*2*Math.PI/n)*r*scale];
  for(let level=1;level<=5;level++)for(let i=0;i<n;i++)line(point(i,level/5),point((i+1)%n,level/5),grid);
  for(let i=0;i<n;i++)line([cx,cy],point(i,1),grid);
  const pts=domains.map((d,i)=>point(i,Math.max(0,Math.min(100,Number(d.value)||0))/100));
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){let inside=false;for(let i=0,j=n-1;i<n;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside)pixel(x,y,[230,221,198]);}
  // Redraw grid on top of the translucent-style fill.
  for(let level=1;level<=5;level++)for(let i=0;i<n;i++)line(point(i,level/5),point((i+1)%n,level/5),grid);
  for(let i=0;i<n;i++){line([cx,cy],point(i,1),grid);line(pts[i],pts[(i+1)%n],gold,2);for(let dx=-5;dx<=5;dx++)for(let dy=-5;dy<=5;dy++)if(dx*dx+dy*dy<=25)pixel(pts[i][0]+dx,pts[i][1]+dy,gold);}
  const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  function text(s,x,y,color,scale=3){for(const ch of s){const glyph=digits[Number(ch)];if(glyph)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyph[row*3+col]==='1')for(let a=0;a<scale;a++)for(let b=0;b<scale;b++)pixel(x+col*scale+a,y+row*scale+b,color);x+=4*scale;}}
  domains.forEach((d,i)=>{const p=point(i,1.19);text(String(i+1).padStart(2,'0'),p[0]-12,p[1]-12,ink);const value=String(Math.max(0,Math.min(100,Number(d.value)||0)));text(value,p[0]-value.length*6,p[1]+10,gold);});
  function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
  function chunk(type,data){const t=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([size,t,data,checksum]);}
  const header=Buffer.alloc(13);header.writeUInt32BE(W);header.writeUInt32BE(H,4);header[8]=8;header[9]=2;
  const raw=Buffer.alloc(H*(W*3+1));for(let y=0;y<H;y++)pixels.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
};
