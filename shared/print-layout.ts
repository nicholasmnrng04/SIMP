import type { ExportCell } from './exports.js';
export type PrintCell={address:string;value:ExportCell;display?:string;style:Record<string,any>};
export type PrintPage={name:string;source:string;cols:number[];heights:number[];merges:string[];cells:PrintCell[];setup:Record<string,any>;svg?:string;chart?:boolean;chartImage?:string;artwork?:{extension:'png'|'jpeg';base64:string;tl:{col:number;row:number};br:{col:number;row:number}}[]};
