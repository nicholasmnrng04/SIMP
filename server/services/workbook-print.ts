import type { PrintPage } from '../../shared/print-layout.js';
import { coordinate } from './workbook-layout.js';
export const xml=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const indexed=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
function color(c:any,fallback:string){
  const base=c?.argb?`#${c.argb.slice(-6)}`:c?.theme!==undefined?['#ffffff','#000000','#e7e6e6','#44546a','#4472c4','#ed7d31','#a5a5a5','#ffc000','#5b9bd5','#70ad47'][c.theme]??fallback:indexed[c?.indexed]?`#${indexed[c.indexed]}`:fallback;
  if(!c?.tint||!/^#[a-f\d]{6}$/i.test(base))return base;
  return '#'+[1,3,5].map(i=>{const v=parseInt(base.slice(i,i+2),16);return Math.round(c.tint<0?v*(1+c.tint):v+(255-v)*c.tint).toString(16).padStart(2,'0');}).join('');
}
export function dimensions(p:PrintPage){const widths=p.cols.map(w=>(w*7+5)*.75);const first=coordinate((p.setup.printArea??'A1').split(':')[0]);return {widths,heights:p.heights,first,width:widths.slice(first.col-1).reduce((n,w)=>n+w,0)};}
export function workbookSvg(p:PrintPage,selectedRows=p.heights.map((_,i)=>i+1).filter(r=>r>=dimensions(p).first.row)){
  const {widths}=dimensions(p),xs=[0],ys=[0];widths.forEach(w=>xs.push(xs.at(-1)!+w));selectedRows.forEach(r=>ys.push(ys.at(-1)!+p.heights[r-1]));
  const offset=xs[dimensions(p).first.col-1],width=xs.at(-1)!-offset,height=ys.at(-1)!;
  const merged=p.merges.map(m=>m.split(':').map(coordinate));
  const pieces:string[]=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${offset} 0 ${width} ${height}"><rect x="${offset}" width="${width}" height="${height}" fill="white"/>`];
  const texts:string[]=[];
  for(const cell of p.cells){
    const {col,row}=coordinate(cell.address),ri=selectedRows.indexOf(row);if(ri<0||col>p.cols.length)continue;
    const merge=merged.find(([a,b])=>col>=a.col&&col<=b.col&&row>=a.row&&row<=b.row);
    if(merge&&(merge[0].col!==col||merge[0].row!==row))continue;
    const x=xs[col-1],y=ys[ri],w=xs[merge?.[1].col??col]-x,h=merge?selectedRows.filter(r=>r>=row&&r<=merge[1].row).reduce((n,r)=>n+p.heights[r-1],0):p.heights[row-1];
    const style=cell.style,fill=style.fill?.pattern==='solid'?color(style.fill.fgColor,'white'):'white';
    pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
    for(const [side,border] of Object.entries(style.border??{}) as [string,any][]){if(!border?.style)continue;const edge=side==='top'?[x,y,x+w,y]:side==='bottom'?[x,y+h,x+w,y+h]:side==='left'?[x,y,x,y+h]:side==='right'?[x+w,y,x+w,y+h]:null;if(edge)pieces.push(`<path d="M${edge[0]} ${edge[1]}L${edge[2]} ${edge[3]}" stroke="${color(border.color,'#333')}" stroke-width="${border.style==='medium'?1.2:.5}"/>`);}
    const text=cell.display??(cell.value===null?'':String(cell.value));if(!text)continue;
    let textWidth=w;
    if(!merge&&!style.alignment?.wrapText&&typeof cell.value==='string'&&(!style.alignment?.horizontal||style.alignment.horizontal==='left')){
      for(let c=col+1;c<=p.cols.length;c++){const next=p.cells.find(v=>{const at=coordinate(v.address);return at.row===row&&at.col===c;});if(next?.value!==null&&next?.value!==undefined)break;if(merged.some(([a,b])=>row>=a.row&&row<=b.row&&c>=a.col&&c<=b.col))break;textWidth+=widths[c-1];}
    }
    if(!merge&&!style.alignment?.wrapText&&typeof cell.value==='string'&&['center','right'].includes(style.alignment?.horizontal)){
      const free=(direction:number)=>{let space=0;for(let c=col+direction;c>=1&&c<=p.cols.length;c+=direction){const next=p.cells.find(v=>{const at=coordinate(v.address);return at.row===row&&at.col===c;});if(next?.value!==null&&next?.value!==undefined)break;if(merged.some(([a,b])=>row>=a.row&&row<=b.row&&c>=a.col&&c<=b.col))break;space+=widths[c-1];}return space;};
      textWidth+=style.alignment.horizontal==='right'?free(-1):2*Math.min(free(-1),free(1));
    }
    let size=style.font?.size??10;const min=Math.min(size,7);
    const wrap=(font:number)=>{const max=Math.max(1,Math.floor((textWidth-4)/(font*.5)));return text.split('\n').flatMap(line=>{const out:string[]=[];let remaining=line;while(remaining.length>max){const space=remaining.lastIndexOf(' ',max);const at=space>max/2?space:max;out.push(remaining.slice(0,at));remaining=remaining.slice(at).trimStart();}return [...out,remaining];});};
    let lines=wrap(size);while(lines.length*size*1.1>h-2&&size>min){size=Math.max(min,size-.5);lines=wrap(size);}
    const maxLines=Math.max(1,Math.floor((h-2)/(size*1.1)));if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].slice(0,-2)+'…';}
    const align=style.alignment?.horizontal??(typeof cell.value==='number'?'right':'left');
    const px=align==='center'?x+w/2:align==='right'?x+w-2:x+2;
    const top=style.alignment?.vertical==='middle'?y+(h-lines.length*size*1.1)/2:y+1;
    lines.forEach((line,i)=>texts.push(`<text x="${px}" y="${top+size+i*size*1.1}" text-anchor="${align==='center'?'middle':align==='right'?'end':'start'}" font-family="Arial, sans-serif" font-size="${size}" ${line.length?`textLength="${Math.min(textWidth-4,line.length*size*(style.font?.name?.includes('Narrow')?.44:.5))}" lengthAdjust="spacingAndGlyphs"`:''} font-weight="${style.font?.bold?'bold':'normal'}" fill="${color(style.font?.color,'#111')}">${xml(line)}</text>`));
  }
  pieces.push(...texts);
  for(const art of p.artwork??[]){
    if(!selectedRows.includes(Math.floor(art.tl.row)+1)||!selectedRows.includes(Math.floor(art.br.row)+1))continue;
    const xAt=(col:number)=>xs[Math.floor(col)]+(col%1)*widths[Math.floor(col)];
    const yAt=(row:number)=>ys[selectedRows.indexOf(Math.floor(row)+1)]+(row%1)*p.heights[Math.floor(row)];
    const x=xAt(art.tl.col),y=yAt(art.tl.row);
    pieces.push(`<image x="${x}" y="${y}" width="${xAt(art.br.col)-x}" height="${yAt(art.br.row)-y}" preserveAspectRatio="none" href="data:image/${art.extension};base64,${art.base64}"/>`);
  }
  if(p.chartImage&&selectedRows.includes(16)&&selectedRows.includes(61))pieces.push(`<image x="${xs[2]}" y="${ys[selectedRows.indexOf(16)]}" width="${xs[28]-xs[2]}" height="${ys[selectedRows.indexOf(61)]-ys[selectedRows.indexOf(16)]}" href="data:image/png;base64,${p.chartImage}"/>`);
  pieces.push('</svg>');return pieces.join('');
}

export function printRowPages(p:PrintPage,availableHeight:number,scale:number){
  const ranges:number[][]=[];let start=dimensions(p).first.row;
  const repeat=p.setup.printTitlesRow?.split(':').map(Number) as number[]|undefined;
  const merged=p.merges.map(m=>m.split(':').map(coordinate));
  while(start<=p.heights.length){
    const headers=start>1&&repeat?Array.from({length:repeat[1]-repeat[0]+1},(_,i)=>repeat[0]+i):[];
    let used=headers.reduce((n,r)=>n+p.heights[r-1],0),end=start;
    while(end<=p.heights.length&&used+p.heights[end-1]<=availableHeight/scale){used+=p.heights[end-1];end++;}
    end=Math.max(start,end-1);
    for(const [a,b] of merged)if(a.row>start&&a.row<=end&&b.row>end)end=a.row-1;
    ranges.push([...headers,...Array.from({length:end-start+1},(_,i)=>start+i)]);start=end+1;
  }
  return ranges;
}
