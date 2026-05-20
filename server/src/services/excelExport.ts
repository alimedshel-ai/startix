import ExcelJS from 'exceljs';

/**
 * Convert a saved Report's JSON data into an .xlsx workbook buffer.
 * The shape we expect per report type matches what controllers/reports.ts
 * builds.
 */
export async function reportToExcel(type: string, title: string, data: unknown): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Startix';
  wb.created = new Date();
  // RTL — Excel uses sheet.views[0].rightToLeft
  const d = (data ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'strategic':  await buildStrategicSheets(wb, title, d); break;
    case 'compliance': await buildComplianceSheets(wb, title, d); break;
    case 'department': await buildDepartmentSheets(wb, title, d); break;
    case 'annual':     await buildAnnualSheets(wb, title, d); break;
    case 'executive':  await buildExecutiveSheets(wb, title, d); break;
    default:           addDumpSheet(wb, 'Report', d);
  }

  for (const sheet of wb.worksheets) {
    sheet.views = [{ rightToLeft: true }];
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 22;
}

function autoSize(sheet: ExcelJS.Worksheet, mins: number[] = []): void {
  sheet.columns.forEach((col, i) => {
    let max = mins[i] ?? 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value == null ? 0 : String(cell.value).length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, span = 4): void {
  sheet.mergeCells(1, 1, 1, span);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(1).height = 28;
}

// ─── Builders ─────────────────────────────────────────────────────────────

async function buildExecutiveSheets(wb: ExcelJS.Workbook, title: string, d: Record<string, unknown>) {
  const sheet = wb.addWorksheet('الملخص التنفيذي');
  addTitle(sheet, title, 2);

  const company = d.company as { name?: string; sector?: string; size?: string; stage?: string } | null;
  const kpi = d.kpiSummary as { total: number; onTrack: number } | undefined;
  const dept = d.deptSummary as { total: number; audited: number } | undefined;

  const rows: [string, string | number | null | undefined][] = [
    ['الاسم', company?.name],
    ['القطاع', company?.sector],
    ['الحجم', company?.size],
    ['المرحلة', company?.stage],
    ['الصحة العامة %', d.healthScore as number],
    ['درجة النضج', d.maturityScore as number],
    ['المسار الاستراتيجي', d.strategicPath as string],
    ['مؤشرات إجمالاً', kpi?.total],
    ['مؤشرات في المسار', kpi?.onTrack],
    ['إدارات إجمالاً', dept?.total],
    ['إدارات مدققة', dept?.audited],
    ['مهام متأخرة', d.overdueTasks as number],
  ];

  rows.forEach((r) => sheet.addRow(r));
  sheet.getColumn(1).font = { bold: true };
  autoSize(sheet, [20, 30]);

  const weaknesses = (d.topWeaknesses as { label: string; pct: number }[] | undefined) ?? [];
  if (weaknesses.length > 0) {
    const ws = wb.addWorksheet('نقاط الضعف');
    addTitle(ws, 'أبرز نقاط الضعف', 2);
    const header = ws.addRow(['البُعد', 'النسبة %']);
    styleHeader(header);
    weaknesses.forEach((w) => ws.addRow([w.label, w.pct]));
    autoSize(ws, [25, 12]);
  }
}

async function buildStrategicSheets(wb: ExcelJS.Workbook, title: string, d: Record<string, unknown>) {
  const overview = wb.addWorksheet('نظرة عامة');
  addTitle(overview, title, 2);
  const company = d.company as { name?: string; sector?: string; size?: string; stage?: string } | null;
  const diag = d.diagnostic as { strategicPath?: string; maturityScore?: number } | null;
  const overviewRows: [string, string | number | null | undefined][] = [
    ['الاسم', company?.name],
    ['القطاع', company?.sector],
    ['الحجم', company?.size],
    ['المرحلة', company?.stage],
    ['المسار الاستراتيجي', diag?.strategicPath],
    ['درجة النضج', diag?.maturityScore],
  ];
  overviewRows.forEach((r) => overview.addRow(r));
  overview.getColumn(1).font = { bold: true };
  autoSize(overview, [22, 30]);

  // SWOT
  const swot = d.swot as { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] } | null;
  if (swot) {
    const ws = wb.addWorksheet('SWOT');
    addTitle(ws, 'تحليل SWOT', 4);
    const header = ws.addRow(['نقاط القوة', 'نقاط الضعف', 'الفرص', 'التهديدات']);
    styleHeader(header);
    const max = Math.max(
      swot.strengths?.length ?? 0,
      swot.weaknesses?.length ?? 0,
      swot.opportunities?.length ?? 0,
      swot.threats?.length ?? 0,
    );
    for (let i = 0; i < max; i += 1) {
      ws.addRow([
        swot.strengths?.[i] ?? '',
        swot.weaknesses?.[i] ?? '',
        swot.opportunities?.[i] ?? '',
        swot.threats?.[i] ?? '',
      ]);
    }
    autoSize(ws);
  }

  // Objectives
  const objectives = (d.objectives as { title: string; type: string; status: string; okrs: { keyResult: string; targetValue: number; currentValue: number; unit: string | null }[] }[] | undefined) ?? [];
  if (objectives.length > 0) {
    const ws = wb.addWorksheet('الأهداف');
    addTitle(ws, 'الأهداف الاستراتيجية', 4);
    const header = ws.addRow(['العنوان', 'النوع', 'الحالة', 'عدد النتائج الرئيسية']);
    styleHeader(header);
    objectives.forEach((o) => ws.addRow([o.title, o.type, o.status, o.okrs.length]));
    autoSize(ws, [30, 15, 12, 18]);
  }

  // KPIs
  const kpis = (d.kpis as { name: string; unit: string; targetValue: number; currentValue: number; frequency: string }[] | undefined) ?? [];
  if (kpis.length > 0) {
    const ws = wb.addWorksheet('المؤشرات');
    addTitle(ws, 'مؤشرات الأداء', 5);
    const header = ws.addRow(['المؤشر', 'الوحدة', 'الهدف', 'الحالي', 'التكرار']);
    styleHeader(header);
    kpis.forEach((k) => ws.addRow([k.name, k.unit, k.targetValue, k.currentValue, k.frequency]));
    autoSize(ws, [30, 10, 12, 12, 12]);
  }
}

async function buildComplianceSheets(wb: ExcelJS.Workbook, title: string, d: Record<string, unknown>) {
  const overview = wb.addWorksheet('نظرة عامة');
  addTitle(overview, title, 2);
  const basic = d.basic as { maturityPct?: number; dangerZone?: string } | null;
  const pro = d.pro as { maturityPct?: number; dangerZone?: string; penaltyEstimate?: number } | null;
  const rows: [string, string | number | null | undefined][] = [
    ['تدقيق أساسي — النضج %', basic?.maturityPct],
    ['تدقيق أساسي — المنطقة', basic?.dangerZone],
    ['تدقيق احترافي — النضج %', pro?.maturityPct],
    ['تدقيق احترافي — المنطقة', pro?.dangerZone],
    ['تعرّض الغرامات (SAR)', pro?.penaltyEstimate],
  ];
  rows.forEach((r) => overview.addRow(r));
  overview.getColumn(1).font = { bold: true };
  autoSize(overview, [30, 18]);

  const proAxes = (d.pro as { axisScores?: unknown } | null)?.axisScores as { axes?: { label: string; regulator: string; maturityPct: number; dangerZone: string }[] } | undefined;
  if (proAxes?.axes && proAxes.axes.length > 0) {
    const ws = wb.addWorksheet('المحاور');
    addTitle(ws, 'محاور الامتثال', 4);
    const header = ws.addRow(['المحور', 'الجهة التنظيمية', 'النضج %', 'المنطقة']);
    styleHeader(header);
    proAxes.axes.forEach((a) => ws.addRow([a.label, a.regulator, a.maturityPct, a.dangerZone]));
    autoSize(ws, [25, 22, 12, 14]);
  }

  const reformPlan = (d.pro as { reformPlan?: { week: number; axis: string; action: string; owner?: string }[] } | null)?.reformPlan ?? [];
  if (reformPlan.length > 0) {
    const ws = wb.addWorksheet('خطة الإصلاح');
    addTitle(ws, 'خطة الإصلاح ١٢ أسبوع', 4);
    const header = ws.addRow(['الأسبوع', 'المحور', 'الإجراء', 'المسؤول']);
    styleHeader(header);
    reformPlan.forEach((r) => ws.addRow([r.week, r.axis, r.action, r.owner ?? '']));
    autoSize(ws, [10, 22, 40, 22]);
  }
}

async function buildDepartmentSheets(wb: ExcelJS.Workbook, title: string, d: Record<string, unknown>) {
  const depts = (d.departments as { type: string; label: string; auditScore: number | null; kpis: { name: string; unit: string; targetValue: number; currentValue: number }[] }[] | undefined) ?? [];

  const summary = wb.addWorksheet('ملخص الإدارات');
  addTitle(summary, title, 3);
  const header = summary.addRow(['الإدارة', 'الصحة %', 'عدد المؤشرات']);
  styleHeader(header);
  depts.forEach((dept) => summary.addRow([dept.label, dept.auditScore != null ? Math.round(dept.auditScore) : '—', dept.kpis.length]));
  autoSize(summary, [22, 14, 16]);

  depts.forEach((dept) => {
    if (dept.kpis.length === 0) return;
    const ws = wb.addWorksheet(dept.label.slice(0, 30));
    addTitle(ws, `مؤشرات ${dept.label}`, 4);
    const h = ws.addRow(['المؤشر', 'الوحدة', 'الهدف', 'الحالي']);
    styleHeader(h);
    dept.kpis.forEach((k) => ws.addRow([k.name, k.unit, k.targetValue, k.currentValue]));
    autoSize(ws, [30, 10, 12, 12]);
  });
}

async function buildAnnualSheets(wb: ExcelJS.Workbook, title: string, d: Record<string, unknown>) {
  const overview = wb.addWorksheet('نظرة عامة');
  addTitle(overview, title, 2);
  overview.addRow(['السنة', d.year as number]);
  overview.addRow(['عدد المهام', d.taskCount as number]);
  overview.addRow(['متأخرات', d.overdueTasks as number]);
  overview.getColumn(1).font = { bold: true };
  autoSize(overview, [22, 14]);

  const objectives = (d.objectives as { title: string; type: string; status: string; okrsCount: number }[] | undefined) ?? [];
  if (objectives.length > 0) {
    const ws = wb.addWorksheet('الأهداف');
    addTitle(ws, 'الأهداف السنوية', 4);
    const h = ws.addRow(['العنوان', 'النوع', 'الحالة', 'النتائج الرئيسية']);
    styleHeader(h);
    objectives.forEach((o) => ws.addRow([o.title, o.type, o.status, o.okrsCount]));
    autoSize(ws, [30, 15, 12, 18]);
  }

  const initiatives = (d.initiatives as { title: string; priority: string; status: string; projectCount: number }[] | undefined) ?? [];
  if (initiatives.length > 0) {
    const ws = wb.addWorksheet('المبادرات');
    addTitle(ws, 'المبادرات', 4);
    const h = ws.addRow(['العنوان', 'الأولوية', 'الحالة', 'عدد المشاريع']);
    styleHeader(h);
    initiatives.forEach((i) => ws.addRow([i.title, i.priority, i.status, i.projectCount]));
    autoSize(ws, [30, 12, 12, 16]);
  }

  const projects = (d.projects as { title: string; status: string; startDate: string | null; endDate: string | null }[] | undefined) ?? [];
  if (projects.length > 0) {
    const ws = wb.addWorksheet('المشاريع');
    addTitle(ws, 'المشاريع', 4);
    const h = ws.addRow(['العنوان', 'الحالة', 'البدء', 'الانتهاء']);
    styleHeader(h);
    projects.forEach((p) => ws.addRow([
      p.title, p.status,
      p.startDate ? new Date(p.startDate).toLocaleDateString('en-US') : '—',
      p.endDate ? new Date(p.endDate).toLocaleDateString('en-US') : '—',
    ]));
    autoSize(ws, [30, 12, 14, 14]);
  }
}

function addDumpSheet(wb: ExcelJS.Workbook, name: string, d: unknown) {
  const sheet = wb.addWorksheet(name);
  sheet.addRow(['JSON dump']);
  sheet.addRow([JSON.stringify(d, null, 2)]);
}
