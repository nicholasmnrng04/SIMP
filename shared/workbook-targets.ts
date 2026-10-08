export type WorkbookTargets = {
  source: string;
  sha256: string;
  weeks: number;
  items: { code: string; name: string; unit: string; contractVolume: string; unitPrice: string; targets: string[] }[];
};
export type WorkbookTargetPreview = {
  source: string;
  sha256: string;
  weeks: number;
  changedCount: number;
  previousWeekConvention: 'PROJECT_START' | 'MONDAY_SUNDAY' | null;
  items: (WorkbookTargets['items'][number] & { workItemId: string; changed: boolean; previousTargets: string[] | null })[];
};
