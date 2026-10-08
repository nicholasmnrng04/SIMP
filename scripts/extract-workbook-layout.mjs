// Development-only extraction: preserve geometry/styles and allowlisted labels, never example data.
import ExcelJS from 'exceljs';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source='LAPORAN PROYEK contoh.xlsx';
const book=new ExcelJS.Workbook();await book.xlsx.readFile(source);
const layouts={};
for(const [name,lastRow,lastCol] of [['M1',91,23],['B1',90,23],['H0',59,16],['TS',78,29]]){
  const sheet=book.getWorksheet(name),cells=[];
  const fixed=name==='H0'?'J2 B6 B8 B9 B10 L8 L9 N9 O9 P9 B11 B12 G12 H12 I12 J12 B14 B15 B16 B17 B18 F19 B21 B22 B23 B24 B25 B26 B27 B28 G30 J30 K30 N30 G31 G32 G33 G34 B34 B35 G35 J35 N35 B42 J42 C48 F48 K48 O48 O49 B58':name==='TS'?'B2 B4 B5 B6 B7 C4 C5 C6 C7 X4 X5 X6 B9 C9 AB9 C14 D63 D64 D65 D66 D67 D70 J70 S70 Z70 D71 J71 S71 Z71':'G3 G4 G5 I2 I3 I4 I5 B9 L10 U10 L11 N11 P11 Q11 R11 S11 T11 U12 C67 C68 C69 C70 O71 Q72 Q73 Q74 Q75 T72 T73 T74 T75 E80 J80 P80 U80 E81 J81 P81 U81 F80 M80 F81 M81';
  for(let r=1;r<=lastRow;r++)for(let c=1;c<=lastCol;c++){
    const cell=sheet.getCell(r,c);if(cell.isMerged&&cell.master.address!==cell.address)continue;
    const keep=fixed.split(' ').includes(cell.address)||(['M1','B1'].includes(name)&&r>=14&&r<=17);
    cells.push({address:cell.address,value:keep&&typeof cell.value==='string'?cell.value:null,style:cell.style});
  }
  const artwork=sheet.getImages().filter(i=>i.range.tl&&i.range.br&&i.range.tl.row<8&&i.range.br.row<=8&&i.range.br.col<=lastCol).map(i=>{const media=book.model.media[Number(i.imageId)];return {extension:media.extension,base64:media.buffer.toString('base64'),tl:{col:i.range.tl.col,row:i.range.tl.row},br:{col:i.range.br.col,row:i.range.br.row}};});
  layouts[name]={source:name,artwork,cols:Array.from({length:lastCol},(_,i)=>sheet.getColumn(i+1).width??8.43),heights:Array.from({length:lastRow},(_,i)=>sheet.getRow(i+1).height??sheet.properties.defaultRowHeight??15),merges:sheet.model.merges.filter(m=>{const end=sheet.getCell(m.split(':')[1]);return end.row<=lastRow&&end.col<=lastCol;}),cells,setup:{...sheet.pageSetup,horizontalDpi:300,verticalDpi:300,printArea:name==='H0'?'B2:P59':sheet.pageSetup.printArea}};
}
mkdirSync('server/templates',{recursive:true});
writeFileSync('server/templates/workbook-layout.json',JSON.stringify({sourceHash:createHash('sha256').update(readFileSync(source)).digest('hex'),layouts}));
console.log('Sanitized workbook layouts extracted: M1, B1, H0, TS.');
