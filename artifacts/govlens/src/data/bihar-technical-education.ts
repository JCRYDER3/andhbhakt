export const BIHAR_TECHNICAL_EDUCATION_PATH = '/state-facts/bihar/technical-education';
export const evidenceCheckedOn = '2026-10-17';
export const departmentRegisterUrl = 'https://betastate.bihar.gov.in/dst/DyPageView?PageTitleID=1619';

export type EquipmentRecord = {
  order: string;
  category: 'engineering' | 'polytechnic';
  institutions: number;
  approvedRupees: number;
  firstInstalmentRupees: number;
  orderDate: string;
  financialYear: string;
  sourceUrl: string;
  billCode: string;
};

// Signed scans: totals/distribution pp. 1–3; conditions p. 3; dispatch p. 4.
// These are sanction records, not independently reconciled expenditure records.
export const equipmentRecords: readonly EquipmentRecord[] = [
  {
    order: '4484', category: 'engineering', institutions: 38,
    approvedRupees: 604999000, firstInstalmentRupees: 393249350,
    orderDate: '2026-08-07', financialYear: '2026–27',
    sourceUrl: 'https://betastate.bihar.gov.in/file_2/FileUpload/2026/Aug/11-Aug-2026/18/DyPage/622af4f5-8d0b-4955-bbd9-c0c5a471a570.pdf',
    billCode: '43-4202021050106',
  },
  {
    order: '4485', category: 'polytechnic', institutions: 46,
    approvedRupees: 604999000, firstInstalmentRupees: 393249350,
    orderDate: '2026-08-07', financialYear: '2026–27',
    sourceUrl: 'https://betastate.bihar.gov.in/file_2/FileUpload/2026/Aug/11-Aug-2026/18/DyPage/3129c3c1-f92e-4157-ad34-ead3922e4f46.pdf',
    billCode: '43-4202021040109',
  },
];
