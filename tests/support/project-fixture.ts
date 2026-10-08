import type { ProjectInput } from '../../shared/projects.js';

export function projectInput(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    projectCode: 'PRJ-001', activityName: 'Peningkatan jalan', projectName: 'Jalan Uji', location: 'Bandung', fiscalYear: 2026,
    contractNumber: 'KONTRAK/001', contractDate: '2026-07-01', initialContractValue: '1000000.25', currentContractValue: '1200000.50',
    startDate: '2026-07-16', endDate: '2026-07-23', clientName: 'Pemberi Uji', clientAgency: 'Instansi Uji',
    clientAgencyAddress: 'Alamat Uji', consultantName: 'Konsultan Uji', contractorName: 'Kontraktor Uji', teamLeaderId: null, description: 'Data sintetis untuk pengujian.', ...overrides,
  };
}
