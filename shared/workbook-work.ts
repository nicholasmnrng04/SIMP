export interface WorkbookWork {
  source: string; sha256: string; note: string;
  items: { code: string; parentCode: string | null; kind: 'GROUP' | 'ITEM'; name: string; unit: string; contractVolume: string; unitPrice: string; source: string; basisSource: string | null; originalVolume: string }[];
}
