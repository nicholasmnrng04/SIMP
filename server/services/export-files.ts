import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { exportCellText, type ExportDocument } from '../../shared/exports.js';
import { workbookSvg, dimensions, printRowPages } from './workbook-print.js';

const require = createRequire(import.meta.url);
const font = require.resolve('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff');
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export async function chartImage(chart:NonNullable<ExportDocument['chart']>){
  const x=(i:number)=>70+((Date.parse(chart.labels[i])-Date.parse(chart.labels[0]))/(Date.parse(chart.labels.at(-1)!)-Date.parse(chart.labels[0])||1))*960;
  const paths=chart.series.map(s=>{let started=false;return `<path fill="none" stroke="${s.color}" stroke-width="3" d="${s.values.map((v,i)=>{if(v===null){started=false;return '';}const move=started?'L':'M';started=true;return `${move}${x(i)},${370-Number(v)*3}`;}).join(' ')}"/>`;}).join('');
  const ticks=[0,25,50,75,100].map(v=>`<text x="12" y="${375-v*3}">${v}%</text><path stroke="#ddd" d="M65 ${370-v*3}H1040"/>`).join('');
  const labels=chart.labels.filter((_,i)=>i===0||i===chart.labels.length-1||i%Math.max(1,Math.ceil(chart.labels.length/6))===0).map(d=>`<text text-anchor="middle" x="${x(chart.labels.indexOf(d))}" y="402">${escape(d)}</text>`).join('');
  const legend=chart.series.map((s,i)=>(s.name.match(/.{1,90}/gu)??[]).map((part,j)=>`<text x="70" y="${435+i*50+j*22}" fill="${s.color}">${escape(part)}</text>`).join('')).join('');
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="600"><rect width="1100" height="600" fill="white"/><g font-family="sans-serif" font-size="15">${ticks}${paths}${labels}${legend}</g></svg>`)).png().toBuffer();
}

export async function renderPdf(data:ExportDocument,images:Map<string,Buffer>=new Map()){
  const pdf=new PDFDocument({size:'A3',layout:'landscape',margin:36,autoFirstPage:!data.layout?.length,bufferPages:true,info:{Title:data.title,Author:'SIMP'}});
  const chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{pdf.on('data',b=>chunks.push(b));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  pdf.font(font);
  for(const page of data.layout??[]){
    const landscape=page.setup.orientation==='landscape',paperWidth=landscape?841.89:595.28,paperHeight=landscape?595.28:841.89;
    const margins=page.setup.margins, left=(margins?.left??.3)*72, right=(margins?.right??.3)*72,top=(margins?.top??.3)*72,bottom=(margins?.bottom??.3)*72;
    const natural=dimensions(page).width,scale=Math.min((paperWidth-left-right)/natural,(page.setup.scale??100)/100);
    for(const rows of printRowPages(page,paperHeight-top-bottom,scale)){
      pdf.addPage({size:'A4',layout:landscape?'landscape':'portrait',margin:0});
      const svg=workbookSvg(page,rows),height=rows.reduce((n,r)=>n+page.heights[r-1],0);
      const png=await sharp(Buffer.from(svg),{density:216}).png().toBuffer();
      pdf.image(png,left+(paperWidth-left-right-natural*scale)/2,top,{width:natural*scale,height:height*scale});
    }
  }
  if(data.layout?.length)pdf.addPage({size:'A3',layout:'landscape',margin:36});
  const width=pdf.page.width-72,bottom=pdf.page.height-55;
  const page=()=>{pdf.addPage();pdf.fontSize(9).fillColor('#555').text(`${data.title} | ${data.generatedAt}`,36,25,{width});pdf.y=48;};
  pdf.fontSize(20).text(data.layout?.length?`Lampiran — ${data.title}`:data.title);pdf.moveDown();
  pdf.fontSize(10);
  for(const [k,v] of data.metadata)pdf.text(`${k}: ${v??'—'}`);
  pdf.moveDown();for(const note of data.notes)pdf.text(note,{paragraphGap:5});
  if(data.chart){page();pdf.fontSize(15).text('Grafik rencana dan aktual');pdf.image(await chartImage(data.chart),36,75,{fit:[width,600]});pdf.y=700;}
  for(const table of data.tables){
    page();pdf.fillColor('#111').fontSize(14).text(table.title);pdf.moveDown(.5);
    const cw=width/table.columns.length,fs=9,line=14,maxLines=Math.floor((bottom-180)/line);
    const wrap=(value:string)=>{
      pdf.fontSize(fs);const lines:string[]=[];let current='';
      for(const char of value){if(char==='\n'){lines.push(current);current='';continue;}if(pdf.widthOfString(current+char)>cw-12&&current){lines.push(current);current=char;}else current+=char;}
      lines.push(current);return lines;
    };
    const draw=(cells:string[][],header=false)=>{
      const h=Math.max(...cells.map(c=>c.length),1)*line+10,y=pdf.y;
      cells.forEach((cell,i)=>{pdf.rect(36+i*cw,y,cw,h).fillAndStroke(header?'#e4eef4':'#ffffff','#b7c6cc');pdf.fillColor('#111').fontSize(fs);cell.forEach((s,n)=>pdf.text(s,42+i*cw,y+5+n*line,{lineBreak:false}));});pdf.y=y+h;
    };
    const header=()=>draw(table.columns.map(c=>wrap(c.label)),true);
    header();
    if(!table.rows.length){pdf.moveDown();pdf.text('Belum ada data pada periode ini.');}
    for(const row of table.rows){const cells=table.columns.map((c,i)=>wrap(exportCellText(row[i]??null,c.numeric)));const n=Math.max(...cells.map(c=>c.length));
      for(let start=0;start<n;start+=maxLines){const part=cells.map(c=>c.slice(start,start+maxLines));const h=Math.max(...part.map(c=>c.length),1)*line+10;if(pdf.y+h>bottom){page();header();}draw(part);}
    }
  }
  for(const photo of data.photos){const bytes=images.get(photo.id);if(!bytes)continue;page();pdf.fontSize(12).text(photo.caption,{width});const y=pdf.y+15;pdf.image(bytes,36,y,{fit:[width,bottom-y]});}
  const range=pdf.bufferedPageRange();for(let i=0;i<range.count;i++){pdf.switchToPage(i);pdf.fontSize(8).fillColor('#555').text(`SIMP | ${i+1} / ${range.count}`,36,pdf.page.height-12,{lineBreak:false});}
  pdf.end();return done;
}

export async function renderXlsx(data:ExportDocument,images:Map<string,Buffer>=new Map()){
  const book=new ExcelJS.Workbook();book.creator='SIMP';book.created=new Date(data.generatedAt);
  for(const page of data.layout??[]){
    const sheet=book.addWorksheet(page.name.slice(0,31));sheet.pageSetup=page.setup as Partial<ExcelJS.PageSetup>;
    page.cols.forEach((width,i)=>{sheet.getColumn(i+1).width=width;});page.heights.forEach((height,i)=>{sheet.getRow(i+1).height=height;});
    for(const cell of page.cells){const target=sheet.getCell(cell.address);target.style=structuredClone(cell.style);target.value=cell.value;}
    for(const range of page.merges)sheet.mergeCells(range);
    sheet.views=[{state:'normal',showGridLines:false}];
    for(const art of page.artwork??[])sheet.addImage(book.addImage({base64:art.base64,extension:art.extension}),{tl:art.tl,br:art.br} as ExcelJS.ImageRange);
    if(page.chartImage)sheet.addImage(book.addImage({base64:page.chartImage,extension:'png'}),'C16:AB61');
  }
  const meta=book.addWorksheet('Informasi');meta.columns=[{width:32},{width:100}];meta.addRow([data.title]);data.metadata.forEach(v=>meta.addRow(v));data.notes.forEach(v=>meta.addRow(['Catatan',v]));
  const exact=book.addWorksheet('Nilai Eksak');exact.columns=[{header:'Lembar',width:32},{header:'Baris',width:12},{header:'Kolom',width:30},{header:'Angka sumber (teks)',width:40}];
  data.tables.forEach((table,index)=>{const sheet=book.addWorksheet(`${index+1} ${table.title}`.slice(0,31));sheet.columns=table.columns.map(c=>({header:c.label,width:c.numeric?22:32}));sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:{row:1,column:table.columns.length}};sheet.pageSetup={orientation:'landscape',paperSize:8 as ExcelJS.PaperSize,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
    table.rows.forEach((row,r)=>sheet.addRow(row.map((cell,c)=>{if(cell===null)return null;if(!table.columns[c].numeric)return String(cell);exact.addRow([sheet.name,r+2,table.columns[c].label,String(cell)]);return Number(cell);} )));
    if(!table.rows.length)sheet.addRow(['Belum ada data pada periode ini.']);
    table.columns.forEach((c,i)=>{if(c.numeric)sheet.getColumn(i+1).numFmt='#,##0.######;[Red]-#,##0.######';});
  });
  if(data.chart){const sheet=book.addWorksheet('Grafik');sheet.addImage(book.addImage({base64:(await chartImage(data.chart)).toString('base64'),extension:'png'}),{tl:{col:0,row:0},ext:{width:1100,height:600}});sheet.addRow(['Data angka tersedia pada lembar Data grafik.']);}
  if(images.size){const sheet=book.addWorksheet('Foto');let row=0;for(const photo of data.photos){const bytes=images.get(photo.id);if(!bytes)continue;sheet.getCell(row+1,1).value=photo.caption;const resized=await sharp(bytes).resize({width:900,height:500,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});sheet.addImage(book.addImage({base64:resized.data.toString('base64'),extension:'png'}),{tl:{col:0,row:row+1},ext:{width:resized.info.width,height:resized.info.height}});row+=36;}}
  book.eachSheet(sheet=>{if(data.layout?.some(p=>p.name.slice(0,31)===sheet.name))return;sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};row.font={name:'Calibri',size:11};let height=30;row.eachCell((cell,c)=>{const width=sheet.getColumn(c).width??30;const lines=String(cell.value??'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(width-2))),0);height=Math.max(height,lines*16+6);});row.height=Math.min(409,height);});sheet.getRow(1).font={name:'Calibri',size:11,bold:true};});
  return Buffer.from(await book.xlsx.writeBuffer());
}
