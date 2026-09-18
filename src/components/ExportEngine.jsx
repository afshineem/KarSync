import * as XLSX from 'xlsx';
import { formatIQD } from '../utils/formatters';

/**
 * Generates and downloads an Excel (.xlsx) spreadsheet
 * Supports both 'summary' (گزارش مجموع) and 'detailed' (گزارش با جزییات)
 */
export function exportAttendanceToExcel({
  logs = [],
  workers = [],
  reportType = 'summary',
  language = 'ku'
}) {
  const isEn = language === 'en';
  const isFa = language === 'fa';

  const workerMap = {};
  workers.forEach((w) => {
    workerMap[w.id] = w;
  });

  if (reportType === 'summary') {
    // -------------------------------------------------------------
    // SUMMARY EXPORT (گزارش مجموع)
    // -------------------------------------------------------------
    const h = {
      workerName: isEn ? 'Worker Name' : isFa ? 'نام کارگر' : 'ناوی کرێکار',
      role: isEn ? 'Role / Title' : isFa ? 'سمت / عنوان شغلی' : 'پیشە / پلە',
      fullDays: isEn ? 'Full Days Count' : isFa ? 'تعداد روز کامل' : 'ژمارەی ڕۆژی تەواو',
      fullDaysPay: isEn ? 'Full Days Pay (IQD)' : isFa ? 'دستمزد روز کامل (دینار)' : 'کرێی ڕۆژی تەواو (دینار)',
      halfDays: isEn ? 'Half Days Count' : isFa ? 'تعداد نیم‌روز' : 'ژمارەی نیوەڕۆژ',
      halfDaysPay: isEn ? 'Half Days Pay (IQD)' : isFa ? 'دستمزد نیم‌روز (دینار)' : 'کرێی نیوەڕۆژ (دینار)',
      otHours: isEn ? 'Overtime Hours' : isFa ? 'ساعات اضافه کاری' : 'کاتژمێری ئۆڤەرتایم',
      otPay: isEn ? 'Overtime Pay (IQD)' : isFa ? 'دستمزد اضافه کاری (دینار)' : 'کرێی ئۆڤەرتایم (دینار)',
      totalPay: isEn ? 'Total Net Pay (IQD)' : isFa ? 'مجموع کل دریافتی (دینار)' : 'کۆی گشتی شایستە (دینار)'
    };

    // Group logs by worker
    const workerStats = {};
    logs.forEach((log) => {
      if (!workerStats[log.workerId]) {
        workerStats[log.workerId] = {
          fullDays: 0,
          fullDaysPay: 0,
          halfDays: 0,
          halfDaysPay: 0,
          otHours: 0,
          otPay: 0,
          totalPay: 0
        };
      }
      const ws = workerStats[log.workerId];
      if (log.type === 'half') {
        ws.halfDays += 1;
        ws.halfDaysPay += Number(log.calculatedDailyWage) || 0;
      } else if (log.type === 'hourly') {
        // Hourly only, no base day pay
      } else {
        ws.fullDays += 1;
        ws.fullDaysPay += Number(log.calculatedDailyWage) || 0;
      }
      ws.otHours += Number(log.overtimeHours) || 0;
      ws.otPay += Number(log.calculatedOvertimeWage) || 0;
      ws.totalPay += Number(log.totalDayPay) || 0;
    });

    const rows = Object.keys(workerStats).map((wId) => {
      const w = workerMap[wId] || { name: 'Unknown', role: '' };
      const s = workerStats[wId];
      return {
        [h.workerName]: w.name,
        [h.role]: w.role || '',
        [h.fullDays]: s.fullDays,
        [h.fullDaysPay]: s.fullDaysPay,
        [h.halfDays]: s.halfDays,
        [h.halfDaysPay]: s.halfDaysPay,
        [h.otHours]: s.otHours,
        [h.otPay]: s.otPay,
        [h.totalPay]: s.totalPay
      };
    });

    // Grand totals row
    const totalFullDays = rows.reduce((acc, r) => acc + (r[h.fullDays] || 0), 0);
    const totalFullPay = rows.reduce((acc, r) => acc + (r[h.fullDaysPay] || 0), 0);
    const totalHalfDays = rows.reduce((acc, r) => acc + (r[h.halfDays] || 0), 0);
    const totalHalfPay = rows.reduce((acc, r) => acc + (r[h.halfDaysPay] || 0), 0);
    const totalOTHours = rows.reduce((acc, r) => acc + (r[h.otHours] || 0), 0);
    const totalOTPay = rows.reduce((acc, r) => acc + (r[h.otPay] || 0), 0);
    const grandTotal = rows.reduce((acc, r) => acc + (r[h.totalPay] || 0), 0);

    rows.push({
      [h.workerName]: isEn ? 'TOTAL SUMMARY' : isFa ? 'مجموع کل کارگاه' : 'کۆی گشتی کارگە',
      [h.role]: '',
      [h.fullDays]: totalFullDays,
      [h.fullDaysPay]: totalFullPay,
      [h.halfDays]: totalHalfDays,
      [h.halfDaysPay]: totalHalfPay,
      [h.otHours]: totalOTHours,
      [h.otPay]: totalOTPay,
      [h.totalPay]: grandTotal
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 }, // Name
      { wch: 22 }, // Role
      { wch: 16 }, // Full Days
      { wch: 22 }, // Full Pay
      { wch: 16 }, // Half Days
      { wch: 22 }, // Half Pay
      { wch: 16 }, // OT Hours
      { wch: 22 }, // OT Pay
      { wch: 24 }  // Total Pay
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary_Report');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Workshop_Summary_Payroll_${dateStr}.xlsx`);

  } else {
    // -------------------------------------------------------------
    // DETAILED EXPORT (گزارش با جزییات)
    // -------------------------------------------------------------
    const h = {
      date: isEn ? 'Date' : isFa ? 'تاریخ' : 'بەروار',
      workerName: isEn ? 'Worker Name' : isFa ? 'نام کارگر' : 'ناوی کرێکار',
      role: isEn ? 'Role / Title' : isFa ? 'سمت / مهارت' : 'پیشە / پلە',
      type: isEn ? 'Type' : isFa ? 'نوع کارکرد' : 'جۆری دەوام',
      daysCount: isEn ? 'Days' : isFa ? 'تعداد روز' : 'ژمارەی ڕۆژ',
      overtimeHours: isEn ? 'Overtime (Hours)' : isFa ? 'اضافه کاری (ساعت)' : 'ئۆڤەرتایم (کاتژمێر)',
      basePay: isEn ? 'Base Pay (IQD)' : isFa ? 'دستمزد پایه (دینار)' : 'کرێی ڕۆژانە (دینار)',
      overtimePay: isEn ? 'Overtime Pay (IQD)' : isFa ? 'دستمزد اضافه کاری (دینار)' : 'کرێی ئۆڤەرتایم (دینار)',
      totalPay: isEn ? 'Total Pay (IQD)' : isFa ? 'جمع کل پرداختی (دینار)' : 'کۆی گشتی شایستە (دینار)',
      notes: isEn ? 'Work Notes' : isFa ? 'توضیحات و شرح کار' : 'تێبینی کارکردن'
    };

    const rows = logs.map((log) => {
      const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
      const daysVal = log.type === 'hourly' ? 0 : log.type === 'half' ? 0.5 : 1.0;
      const typeLabel = log.type === 'hourly'
        ? (isEn ? 'Hourly Only' : isFa ? 'فقط ساعتی' : 'تەنها سەعاتی')
        : log.type === 'half' 
        ? (isEn ? 'Half Day' : isFa ? 'نیم‌روز' : 'نیوە ڕۆژ')
        : (isEn ? 'Full Day' : isFa ? 'روز کامل' : 'ڕۆژی تەواو');

      return {
        [h.date]: log.date,
        [h.workerName]: worker.name,
        [h.role]: worker.role || '',
        [h.type]: typeLabel,
        [h.daysCount]: daysVal,
        [h.overtimeHours]: Number(log.overtimeHours) || 0,
        [h.basePay]: Number(log.calculatedDailyWage) || 0,
        [h.overtimePay]: Number(log.calculatedOvertimeWage) || 0,
        [h.totalPay]: Number(log.totalDayPay) || 0,
        [h.notes]: log.notes || ''
      };
    });

    const totalDays = rows.reduce((acc, r) => acc + (r[h.daysCount] || 0), 0);
    const totalOT = rows.reduce((acc, r) => acc + (r[h.overtimeHours] || 0), 0);
    const totalBase = rows.reduce((acc, r) => acc + (r[h.basePay] || 0), 0);
    const totalOTPay = rows.reduce((acc, r) => acc + (r[h.overtimePay] || 0), 0);
    const grandTotal = rows.reduce((acc, r) => acc + (r[h.totalPay] || 0), 0);

    rows.push({
      [h.date]: isEn ? 'TOTAL SUMMARY' : isFa ? 'مجموع کل' : 'کۆی گشتی',
      [h.workerName]: '',
      [h.role]: '',
      [h.type]: '',
      [h.daysCount]: totalDays,
      [h.overtimeHours]: totalOT,
      [h.basePay]: totalBase,
      [h.overtimePay]: totalOTPay,
      [h.totalPay]: grandTotal,
      [h.notes]: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 26 },
      { wch: 22 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 35 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed_Report');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Workshop_Detailed_Attendance_${dateStr}.xlsx`);
  }
}

/**
 * Triggers browser print dialog
 */
export function triggerPrintReport() {
  window.print();
}
