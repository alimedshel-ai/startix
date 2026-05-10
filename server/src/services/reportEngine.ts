// Report aggregation. Phase 4 ships the signature; PDF/Excel generation
// (S3 upload + presign + download links) lands in Phase 8.

export interface ReportInput {
  companyId: string;
  type: 'strategic' | 'compliance' | 'dept' | 'annual';
  diagnostics?: unknown;
  audits?: unknown;
  swot?: unknown;
  okrs?: unknown;
  reviews?: unknown;
}

export interface StructuredReport {
  type: ReportInput['type'];
  generatedAt: string;
  companyId: string;
  sections: { title: string; data: unknown }[];
}

export function buildReport(input: ReportInput): StructuredReport {
  const sections: StructuredReport['sections'] = [];
  if (input.diagnostics) sections.push({ title: 'Diagnostics', data: input.diagnostics });
  if (input.audits) sections.push({ title: 'Department audits', data: input.audits });
  if (input.swot) sections.push({ title: 'SWOT / TOWS', data: input.swot });
  if (input.okrs) sections.push({ title: 'OKRs & KPIs', data: input.okrs });
  if (input.reviews) sections.push({ title: 'Reviews', data: input.reviews });
  return {
    type: input.type,
    generatedAt: new Date().toISOString(),
    companyId: input.companyId,
    sections,
  };
}
