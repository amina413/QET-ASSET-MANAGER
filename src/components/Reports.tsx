
"use client";

import React, { useState, useMemo } from 'react';
import { Download, Filter, FileText, CheckCircle, Loader2, Calendar, ArrowLeft, ArrowRightLeft, Trash2 } from 'lucide-react';
import { CATEGORIES, CONDITION_DESCRIPTIONS } from '@/constants';
import { ConditionCode, Asset } from '@/types';
import { calculateDepreciationSchedule, DepreciationMethod as UtilDepreciationMethod } from '@/utils/depreciation';
import { getFullyDepreciatedAssets, generatePeriodScheduleByCategory, generateCustomPeriodScheduleByCategory, clearAssetCache } from '@/utils/reportData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { arraysToCsv, downloadCsv } from '@/utils/csv';

interface ReportsProps {
  onBack?: () => void;
  onNavigateToAsset?: (assetId: string) => void;
  assets?: Asset[];
}

const Reports: React.FC<ReportsProps> = ({ onBack, onNavigateToAsset, assets = [] }) => {
  const [reportType, setReportType] = useState<string>('Asset Register Summary');
  const [filterStatusGroup, setFilterStatusGroup] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [selectedConditions, setSelectedConditions] = useState<ConditionCode[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [reportPeriodType, setReportPeriodType] = useState<'Yearly' | 'Monthly' | 'Custom'>('Yearly');
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [reportPeriodYear, setReportPeriodYear] = useState<number>(currentYear);
  const [reportPeriodMonth, setReportPeriodMonth] = useState<number>(currentMonth);
  const [customPeriodFrom, setCustomPeriodFrom] = useState('');
  const [customPeriodTo, setCustomPeriodTo] = useState('');

  // Helper to Title Case
  const toTitleCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  };

  // Extract unique locations from actual assets with normalization
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    assets.forEach(asset => {
      if (asset.location && asset.location.trim()) {
        locations.add(toTitleCase(asset.location.trim()));
      }
    });
    return Array.from(locations).sort();
  }, [assets]);

  // Clear cache on mount and unmount to ensure fresh data and free memory
  React.useEffect(() => {
    clearAssetCache();
    return () => {
      clearAssetCache();
    };
  }, []);

  // Filter groups
  const OPERATIONAL_CODES: ConditionCode[] = ['A1', 'A2', 'A3', 'A4'];
  const MAINTENANCE_CODES: ConditionCode[] = ['F1', 'F2', 'F3'];
  const DISPOSED_CODES: ConditionCode[] = ['F4'];

  const toggleCondition = (code: ConditionCode) => {
    if (selectedConditions.includes(code)) {
      setSelectedConditions(selectedConditions.filter(c => c !== code));
    } else {
      setSelectedConditions([...selectedConditions, code]);
    }
  };

  const selectGroup = (group: 'All' | 'Operational' | 'Maintenance' | 'Disposed') => {
    setFilterStatusGroup(group);
    if (group === 'All') setSelectedConditions([]);
    else if (group === 'Operational') setSelectedConditions(OPERATIONAL_CODES);
    else if (group === 'Maintenance') setSelectedConditions(MAINTENANCE_CODES);
    else if (group === 'Disposed') setSelectedConditions(DISPOSED_CODES);
  };

  // Filter the assets
  const filteredAssets = assets.filter(asset => {
    // Condition Filtering
    let matchesCondition = true;
    if (filterStatusGroup !== 'All' || selectedConditions.length > 0) {
      if (selectedConditions.length > 0) {
        matchesCondition = !!asset.conditionCode && selectedConditions.includes(asset.conditionCode);
      }
    }

    // Category Filtering
    let matchesCategory = true;
    if (filterCategory !== 'All') {
      matchesCategory = asset.category === filterCategory;
    }

    // Location Filtering
    let matchesLocation = true;
    if (filterLocation !== 'All') {
      // Case-insensitive comparison
      matchesLocation = (asset.location || '').toLowerCase() === filterLocation.toLowerCase();
    }

    // Date Range Filtering
    let matchesDate = true;
    if (dateRange.from) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) >= new Date(dateRange.from);
    }
    if (dateRange.to) {
      matchesDate = matchesDate && new Date(asset.acquisitionDate) <= new Date(dateRange.to);
    }

    // For Disposal List, filter for disposed assets and still apply report period & other filters
    if (reportType === 'Disposal List') {
      const isDisposed = asset.status === 'Disposed' || asset.conditionCode === 'F4';
      return isDisposed && matchesCondition && matchesDate && matchesCategory && matchesLocation;
    }

    return matchesCondition && matchesDate && matchesCategory && matchesLocation;
  });

  // For yearly schedule: exclude disposed (F4); for fully depreciated: include all
  const assetsForSchedule = useMemo(() => {
    return assets.filter((a) => {
      const matchesCategory = filterCategory === 'All' || a.category === filterCategory;
      const matchesLocation = filterLocation === 'All' || a.location === filterLocation;
      let matchesDate = true;
      if (dateRange.from) matchesDate = matchesDate && new Date(a.acquisitionDate) >= new Date(dateRange.from);
      if (dateRange.to) matchesDate = matchesDate && new Date(a.acquisitionDate) <= new Date(dateRange.to);
      const notDisposed = a.status !== 'Disposed' && a.conditionCode !== 'F4';
      return matchesCategory && matchesLocation && matchesDate && notDisposed;
    });
  }, [assets, filterCategory, filterLocation, dateRange]);

  const assetsForFullyDepreciated = useMemo(() => {
    return assets.filter((a) => {
      const matchesCategory = filterCategory === 'All' || a.category === filterCategory;
      const matchesLocation = filterLocation === 'All' || a.location === filterLocation;
      return matchesCategory && matchesLocation;
    });
  }, [assets, filterCategory, filterLocation]);

  const periodScheduleByCategory = useMemo(
    () => {
      if (reportPeriodType === 'Yearly') {
        return generatePeriodScheduleByCategory(assetsForSchedule, reportPeriodYear);
      }

      // Calculate dates for Monthly or Custom
      let fromStr = '';
      let toStr = '';

      if (reportPeriodType === 'Monthly') {
        // First day of selected month
        const fromDate = new Date(reportPeriodYear, reportPeriodMonth - 1, 1);
        // Last day of selected month
        const toDate = new Date(reportPeriodYear, reportPeriodMonth, 0);

        // Format to YYYY-MM-DD
        // Note: toISOString() uses UTC. We want local midnight.
        const offset = fromDate.getTimezoneOffset() * 60000;
        fromStr = new Date(fromDate.getTime() - offset).toISOString().split('T')[0];
        const toOffset = toDate.getTimezoneOffset() * 60000;
        toStr = new Date(toDate.getTime() - toOffset).toISOString().split('T')[0];
      } else {
        // Custom
        if (!customPeriodFrom || !customPeriodTo) return [];
        fromStr = customPeriodFrom;
        toStr = customPeriodTo;
      }

      return generateCustomPeriodScheduleByCategory(assetsForSchedule, fromStr, toStr);
    },
    [assetsForSchedule, reportPeriodYear, reportPeriodType, reportPeriodMonth, customPeriodFrom, customPeriodTo]
  );
  const fullyDepreciated = useMemo(() => {
    const list = getFullyDepreciatedAssets(assetsForFullyDepreciated);
    if (!dateRange.from && !dateRange.to) return list;
    return list.filter((item) => {
      const fdDate = new Date(item.fullyDepreciatedDate);
      if (dateRange.from && fdDate < new Date(dateRange.from)) return false;
      if (dateRange.to && fdDate > new Date(dateRange.to)) return false;
      return true;
    });
  }, [assetsForFullyDepreciated, dateRange]);

  // Transfer history derived from live asset history
  const transferHistory = useMemo(() => assets.flatMap(a => (a.history || []).filter(h =>
    h.type === 'Transfer' &&
    (filterCategory === 'All' || a.category === filterCategory)
  )), [assets, filterCategory]);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setIsGenerating(false);
  };

  const loadLogoAsBase64 = async (): Promise<string | null> => {
    try {
      const res = await fetch('/qet-logo-circular.svg');
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toISOString().split('T')[0];
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header: Logo + Company branding
      const logoData = await loadLogoAsBase64();
      if (logoData) {
        doc.addImage(logoData, 'PNG', 14, 8, 24, 24);
      }
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('QET', logoData ? 44 : 14, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Asset Management | assurance - tax - advisory', logoData ? 44 : 14, 23);

      // Report title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(reportType, 14, 34);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${dateStr} | Filters: ${getFiltersSummary() || 'All'}`, 14, 40);
      doc.text(`Records: ${reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule' ? periodScheduleByCategory.length : reportType === 'Fully Depreciated Assets' ? fullyDepreciated.length : filteredAssets.length}`, 14, 46);
      if (reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule') {
        doc.text(`Report Period: ${reportPeriodYear}`, 14, 52);
      }

      let tableData: (string | number)[][] = [];
      let tableCols: string[] = [];

      if (reportType === 'Fixed Asset Schedule') {
        tableCols = ['Category', 'Cost Opening balance', 'Additions in the year', 'Disposal in the year', 'Total Cost', 'Accum DEPR opening balance', 'DEPR Charge in the year', 'Disposed in the year', 'Total Accum DEPR', 'Net Book Value'];
        tableData = periodScheduleByCategory.map((r) => [
          r.category,
          r.costOpening.toLocaleString(),
          r.costAdditions.toLocaleString(),
          r.costDisposed.toLocaleString(),
          r.costClosing.toLocaleString(),
          r.deprOpening.toLocaleString(),
          r.deprCharge.toLocaleString(),
          r.deprDisposed.toLocaleString(),
          r.deprClosing.toLocaleString(),
          r.nbvCurrent.toLocaleString(),
        ]);
      } else if (reportType === 'Depreciation Schedule') {
        tableCols = ['Category', 'Accum DEPR opening balance', 'DEPR Charge in the year', 'Disposed in the year', 'Total Accum DEPR', 'Net Book Value'];
        tableData = periodScheduleByCategory.map((r) => [
          r.category,
          r.deprOpening.toLocaleString(),
          r.deprCharge.toLocaleString(),
          r.deprDisposed.toLocaleString(),
          r.deprClosing.toLocaleString(),
          r.nbvCurrent.toLocaleString(),
        ]);
      } else if (reportType === 'Fully Depreciated Assets') {
        tableCols = ['Product ID', 'Asset Name', 'Category', 'Original Cost', 'Accum. Depr.', 'Salvage', 'NBV', 'Fully Depr. Date'];
        tableData = fullyDepreciated.map((r) => [
          r.productId,
          r.name,
          r.category,
          r.originalCost.toLocaleString(),
          r.accumulatedDepreciation.toLocaleString(),
          r.salvageValue.toLocaleString(),
          r.nbvAtEnd.toLocaleString(),
          r.fullyDepreciatedDate,
        ]);
      } else if (reportType === 'Full Asset Register') {
        tableCols = ['Product ID', 'Asset Name', 'Category', 'Sub Category', 'Acquisition Cost', 'Acquisition Date', 'Registration Date', 'Location', 'Custodian', 'Useful Life', 'Depr. (Year)', 'Accum. Depr.', 'Net Book Value', 'Status', 'Condition'];
        tableData = filteredAssets.map((a) => {
          const yearlyDepr = getDepreciationForYear(a);
          const schedule = calculateDepreciationSchedule({
            acquisition_cost: a.acquisitionCost,
            registration_date: a.registrationDate || a.acquisitionDate,
            useful_life: a.usefulLife || 5,
            salvage_value: a.salvageValue || 0,
            method: (a.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod,
          });
          const entry = schedule.find((s) => s.fiscal_year === new Date().getFullYear());
          const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (a.acquisitionCost - a.netBookValue);
          const netBookValue = entry ? entry.net_book_value : a.netBookValue;
          return [
            a.productId,
            a.name,
            a.category,
            a.subCategory || '-',
            a.acquisitionCost.toLocaleString(),
            a.acquisitionDate,
            a.registrationDate || '-',
            a.location,
            a.custodian,
            a.usefulLife ?? '-',
            Math.round(yearlyDepr).toLocaleString(),
            Math.round(accumulatedDepreciation).toLocaleString(),
            Math.round(netBookValue).toLocaleString(),
            a.status,
            a.conditionCode || 'N/A',
          ];
        });
      } else if (reportType === 'Asset Register Summary') {
        tableCols = ['Product ID', 'Asset Name', 'Category', 'Acquisition Cost', 'Additions', 'Depr. (Year)', 'Accum. Depr.', 'NBV', 'Condition'];
        tableData = filteredAssets.map((a) => {
          const yearlyDepr = getDepreciationForYear(a);
          const schedule = calculateDepreciationSchedule({
            acquisition_cost: a.acquisitionCost,
            registration_date: a.registrationDate || a.acquisitionDate,
            useful_life: a.usefulLife || 5,
            salvage_value: a.salvageValue || 0,
            method: (a.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod,
          });
          const entry = schedule.find((s) => s.fiscal_year === new Date().getFullYear());
          const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (a.acquisitionCost - a.netBookValue);
          const additions = a.improvements ? a.improvements.filter((imp) => imp.type === 'Addition').reduce((sum, imp) => sum + imp.amount, 0) : 0;
          return [
            a.productId,
            a.name,
            a.category,
            a.acquisitionCost.toLocaleString(),
            additions.toLocaleString(),
            Math.round(yearlyDepr).toLocaleString(),
            Math.round(accumulatedDepreciation).toLocaleString(),
            (entry ? entry.net_book_value : a.netBookValue).toLocaleString(),
            a.conditionCode || 'N/A',
          ];
        });
      } else if (reportType === 'Disposal List') {
        tableCols = ['Product ID', 'Asset Name', 'Category', 'Acquisition Cost', 'NBV', 'Disposal Date', 'Mode'];
        tableData = filteredAssets.map((a) => [
          a.productId,
          a.name,
          a.category,
          a.acquisitionCost.toLocaleString(),
          a.netBookValue.toLocaleString(),
          a.disposalDate || 'N/A',
          a.disposalMode || 'Disposed',
        ]);
      } else if (reportType === 'Transfer Report') {
        tableCols = ['Date', 'Asset ID', 'From', 'To', 'Custodian', 'Action By'];
        tableData = transferHistory.map((h) => {
          const asset = assets.find((a) => a.id === h.assetId);
          return [h.date, asset ? asset.productId : 'Unknown', h.fromLocation || '-', h.toLocation || '-', h.toCustodian || '-', h.user];
        });
      }

      if (tableData.length > 0) {
        const startY = (reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule') ? 58 : 54;
        autoTable(doc, {
          head: [tableCols],
          body: tableData,
          startY,
          theme: 'striped',
          styles: { fontSize: 8 },
        });
      } else {
        const noDataY = (reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule') ? 58 : 54;
        doc.text('No data matches the current filters.', 14, noDataY);
      }

      let periodSuffix = '';
      if (reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule') periodSuffix = `_Period_${reportPeriodYear}`;
      doc.save(`QET_Report_${reportType.replace(/\s+/g, '_')}${periodSuffix}_${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getFiltersSummary = () => {
    const parts: string[] = [];
    if (filterCategory !== 'All') parts.push(`Category: ${filterCategory}`);
    if (filterLocation !== 'All') parts.push(`Location: ${filterLocation}`);
    if (filterStatusGroup !== 'All') parts.push(`Status: ${filterStatusGroup}`);
    if (dateRange.from || dateRange.to) parts.push(`Period: ${dateRange.from || '…'} to ${dateRange.to || '…'}`);
    return parts.join(' • ');
  };

  const handleExport = async () => {
    if (exportFormat === 'pdf') {
      await handleExportPDF();
      return;
    }
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const reportTitle = reportType.replace(/\s+/g, '_');
      let data: Record<string, string | number>[] = [];

      if (reportType === 'Full Asset Register') {
        data = filteredAssets.map((asset) => {
          const yearlyDepr = getDepreciationForYear(asset);
          const schedule = calculateDepreciationSchedule({
            acquisition_cost: asset.acquisitionCost,
            registration_date: asset.registrationDate || asset.acquisitionDate,
            useful_life: asset.usefulLife || 5,
            salvage_value: asset.salvageValue || 0,
            method: (asset.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod
          });
          const currentYear = new Date().getFullYear();
          const entry = schedule.find(s => s.fiscal_year === currentYear);
          const netBookValue = entry ? entry.net_book_value : asset.netBookValue;
          const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (asset.acquisitionCost - asset.netBookValue);
          return {
            'Product ID': asset.productId,
            'Asset Name': asset.name,
            'Category': asset.category,
            'Sub Category': asset.subCategory || '-',
            'Acquisition Cost': asset.acquisitionCost,
            'Acquisition Date': asset.acquisitionDate,
            'Registration Date': asset.registrationDate || '-',
            'Location': asset.location,
            'Custodian': asset.custodian,
            'Useful Life': asset.usefulLife ?? '',
            'Depreciation (Year)': Math.round(yearlyDepr),
            'Accumulated Depr.': Math.round(accumulatedDepreciation),
            'Net Book Value': Math.round(netBookValue),
            'Status': asset.status,
            'Condition': asset.conditionCode || 'N/A'
          };
        });
      } else if (reportType === 'Asset Register Summary') {
        data = filteredAssets.map((asset) => {
          const yearlyDepr = getDepreciationForYear(asset);
          const schedule = calculateDepreciationSchedule({
            acquisition_cost: asset.acquisitionCost,
            registration_date: asset.registrationDate || asset.acquisitionDate,
            useful_life: asset.usefulLife || 5,
            salvage_value: asset.salvageValue || 0,
            method: (asset.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod
          });
          const currentYear = new Date().getFullYear();
          const entry = schedule.find(s => s.fiscal_year === currentYear);
          const netBookValue = entry ? entry.net_book_value : asset.netBookValue;
          const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (asset.acquisitionCost - asset.netBookValue);
          const additions = asset.improvements
            ? asset.improvements.filter(imp => imp.type === 'Addition').reduce((sum, imp) => sum + imp.amount, 0)
            : 0;
          return {
            'Product ID': asset.productId,
            'Asset Name': asset.name,
            'Category': asset.category,
            'Acquisition Cost': asset.acquisitionCost,
            'Additions': additions,
            'Depreciation (Year)': Math.round(yearlyDepr),
            'Accumulated Depr.': Math.round(accumulatedDepreciation),
            'Net Book Value': Math.round(netBookValue),
            'Condition': asset.conditionCode || 'N/A'
          };
        });
      } else if (reportType === 'Fixed Asset Schedule') {
        data = periodScheduleByCategory.map((row) => ({
          'Category': row.category,
          'Cost Opening balance': row.costOpening,
          'Additions in the year': row.costAdditions,
          'Disposal in the year': row.costDisposed,
          'Total Cost': row.costClosing,
          'NBV Opening balance': row.nbvPrior,
          'Accum DEPR opening balance': row.deprOpening,
          'DEPR Charge in the year': row.deprCharge,
          'Disposed in the year': row.deprDisposed,
          'Total Accum DEPR': row.deprClosing,
          'Net Book Value': row.nbvCurrent
        }));
      } else if (reportType === 'Depreciation Schedule') {
        data = periodScheduleByCategory.map((row) => ({
          'Category': row.category,
          'NBV Opening balance': row.nbvPrior,
          'Accum DEPR opening balance': row.deprOpening,
          'DEPR Charge in the year': row.deprCharge,
          'Disposed in the year': row.deprDisposed,
          'Total Accum DEPR': row.deprClosing,
          'Net Book Value': row.nbvCurrent
        }));
      } else if (reportType === 'Fully Depreciated Assets') {
        data = fullyDepreciated.map((row) => ({
          'Product ID': row.productId,
          'Asset Name': row.name,
          'Category': row.category,
          'Original Cost': row.originalCost,
          'Accumulated Depr.': row.accumulatedDepreciation,
          'Salvage Value': row.salvageValue,
          'NBV at End': row.nbvAtEnd,
          'Fully Depreciated Date': row.fullyDepreciatedDate
        }));
      } else if (reportType === 'Transfer Report') {
        data = transferHistory.map((h) => {
          const asset = assets.find(a => a.id === h.assetId);
          return {
            'Date': h.date,
            'Asset ID': asset ? asset.productId : 'Unknown',
            'From Location': h.fromLocation || '-',
            'To Location': h.toLocation || '-',
            'Custodian': h.toCustodian || '-',
            'Action By': h.user
          };
        });
      } else if (reportType === 'Disposal List') {
        data = filteredAssets.map((asset) => ({
          'Product ID': asset.productId,
          'Asset Name': asset.name,
          'Category': asset.category,
          'Acquisition Cost': asset.acquisitionCost,
          'Net Book Value': asset.netBookValue,
          'Disposal Date': asset.disposalDate || 'N/A',
          'Mode of Disposal': asset.disposalMode || 'Disposed'
        }));
      }

      // Build sheet with professional header
      const headerRows = [
        ['QET Asset Management'],
        ['assurance - tax - advisory'],
        [reportType],
        [`Generated: ${dateStr} | Filters: ${getFiltersSummary() || 'All'}`],
        ...(reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule' ? [[`Report Period: ${reportPeriodYear}`]] : []),
        []
      ];
      const dataRows = data.length
        ? [Object.keys(data[0]) as string[], ...data.map((row) => Object.values(row) as (string | number)[])]
        : [['No data'], ['No records match the current filters.']];
      const allRows = [...headerRows, ...dataRows];
      const periodSuffix = (reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule') ? `_Period_${reportPeriodYear}` : '';
      downloadCsv(`QET_Report_${reportTitle}${periodSuffix}_${dateStr}.csv`, arraysToCsv(allRows));
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getBadgeColor = (code?: ConditionCode) => {
    if (!code) return 'bg-slate-100 text-slate-700';
    if (OPERATIONAL_CODES.includes(code)) return 'bg-green-100 text-green-800 border-green-200';
    if (MAINTENANCE_CODES.includes(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (DISPOSED_CODES.includes(code)) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700';
  };

  const getDepreciationForYear = (asset: Asset) => {
    if (!asset.usefulLife || asset.usefulLife <= 0) return 0;

    // Use the robust utility
    const schedule = calculateDepreciationSchedule({
      acquisition_cost: asset.acquisitionCost,
      registration_date: asset.registrationDate || asset.acquisitionDate,
      useful_life: asset.usefulLife,
      salvage_value: asset.salvageValue || 0,
      method: (asset.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod
    });

    const currentYear = new Date().getFullYear();
    const entry = schedule.find(s => s.fiscal_year === currentYear);
    return entry ? entry.depreciation_expense : 0;
  };

  const renderReportTable = () => {
    switch (reportType) {
      case 'Asset Register Summary':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Additions</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Depreciation (Year)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accumulated Depr.</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const yearlyDepr = getDepreciationForYear(asset);
                  // Recalculate accumulated based on schedule for accuracy
                  const schedule = calculateDepreciationSchedule({
                    acquisition_cost: asset.acquisitionCost,
                    registration_date: asset.registrationDate || asset.acquisitionDate,
                    useful_life: asset.usefulLife || 5,
                    salvage_value: asset.salvageValue || 0,
                    method: (asset.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod
                  });
                  const currentYear = new Date().getFullYear();
                  const entry = schedule.find(s => s.fiscal_year === currentYear);

                  // Use robust NBV and Accumulated from schedule if available
                  const netBookValue = entry ? entry.net_book_value : asset.netBookValue;
                  const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (asset.acquisitionCost - asset.netBookValue);

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigateToAsset && onNavigateToAsset(asset.id)}>
                      <td className="p-4 text-sm font-mono text-slate-600 group-hover:text-qet-600 font-bold">{asset.productId}</td>
                      <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">
                        {asset.improvements ? `₦${asset.improvements.reduce((acc, imp) => imp.type === 'Addition' ? acc + imp.amount : acc, 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{yearlyDepr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{accumulatedDepreciation.toLocaleString()}</td>
                      <td className="p-4 text-sm font-semibold text-slate-800 text-right">₦{netBookValue.toLocaleString()}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getBadgeColor(asset.conditionCode)}`}>
                          {asset.conditionCode || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No assets found matching the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Full Asset Register':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Sub Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Acquisition Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Registration Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Location</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Custodian</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Useful Life</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Depr. (Year)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accum. Depr.</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const yearlyDepr = getDepreciationForYear(asset);
                  const schedule = calculateDepreciationSchedule({
                    acquisition_cost: asset.acquisitionCost,
                    registration_date: asset.registrationDate || asset.acquisitionDate,
                    useful_life: asset.usefulLife || 5,
                    salvage_value: asset.salvageValue || 0,
                    method: (asset.method ?? 'STRAIGHT_LINE') as UtilDepreciationMethod
                  });
                  const currentYear = new Date().getFullYear();
                  const entry = schedule.find(s => s.fiscal_year === currentYear);
                  const netBookValue = entry ? entry.net_book_value : asset.netBookValue;
                  const accumulatedDepreciation = entry ? entry.accumulated_depreciation : (asset.acquisitionCost - asset.netBookValue);

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigateToAsset && onNavigateToAsset(asset.id)}>
                      <td className="p-4 text-sm font-mono text-slate-600 group-hover:text-qet-600 font-bold">{asset.productId}</td>
                      <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.subCategory || '-'}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.acquisitionDate}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.registrationDate || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.location}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.custodian}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">{asset.usefulLife ?? '-'}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{yearlyDepr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-sm text-slate-600 text-right">₦{accumulatedDepreciation.toLocaleString()}</td>
                      <td className="p-4 text-sm font-semibold text-slate-800 text-right">₦{netBookValue.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.status}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getBadgeColor(asset.conditionCode)}`}>
                          {asset.conditionCode || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={15} className="p-8 text-center text-slate-400">No assets found matching the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Fixed Asset Schedule': {
        const periodRows = periodScheduleByCategory;
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Period Type:</label>
                <select
                  value={reportPeriodType}
                  onChange={(e) => setReportPeriodType(e.target.value as any)}
                  className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Yearly">Yearly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </div>

              {reportPeriodType === 'Yearly' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Year:</label>
                  <select
                    value={reportPeriodYear}
                    onChange={(e) => setReportPeriodYear(Number(e.target.value))}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {Array.from({ length: 15 }, (_, i) => currentYear - 10 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}



              {reportPeriodType === 'Monthly' && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Month:</label>
                    <select
                      value={reportPeriodMonth}
                      onChange={(e) => setReportPeriodMonth(Number(e.target.value))}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Year:</label>
                    <select
                      value={reportPeriodYear}
                      onChange={(e) => setReportPeriodYear(Number(e.target.value))}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {Array.from({ length: 15 }, (_, i) => currentYear - 10 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {reportPeriodType === 'Custom' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">From:</label>
                  <input
                    type="date"
                    value={customPeriodFrom}
                    onChange={(e) => setCustomPeriodFrom(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <label className="text-sm font-medium text-slate-600">To:</label>
                  <input
                    type="date"
                    value={customPeriodTo}
                    onChange={(e) => setCustomPeriodTo(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
              )}
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Cost Opening balance</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Additions in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Disposal in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Cost</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">NBV Opening balance</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accum DEPR opening balance</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">DEPR Charge in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Disposed in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Accum DEPR</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodRows.length > 0 ? (
                  periodRows.map((row) => (
                    <tr key={row.category} className="hover:bg-slate-50">
                      <td className="p-4 text-sm font-bold text-slate-800">{row.category}</td>
                      <td className="p-4 text-sm text-right">₦{row.costOpening.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right text-green-600">₦{row.costAdditions.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right text-red-600">₦{row.costDisposed.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right font-medium">₦{row.costClosing.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right font-medium">₦{row.nbvPrior.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right">₦{row.deprOpening.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right">₦{row.deprCharge.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right text-red-600">₦{row.deprDisposed.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right font-medium">₦{row.deprClosing.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-qet-700 text-right">₦{row.nbvCurrent.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={11} className="p-8 text-center text-slate-400">No data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case 'Depreciation Schedule': {
        const periodRows = periodScheduleByCategory;
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Period Type:</label>
                <select
                  value={reportPeriodType}
                  onChange={(e) => setReportPeriodType(e.target.value as any)}
                  className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Yearly">Yearly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </div>

              {reportPeriodType === 'Yearly' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Year:</label>
                  <select
                    value={reportPeriodYear}
                    onChange={(e) => setReportPeriodYear(Number(e.target.value))}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {Array.from({ length: 15 }, (_, i) => currentYear - 10 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}



              {reportPeriodType === 'Monthly' && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Month:</label>
                    <select
                      value={reportPeriodMonth}
                      onChange={(e) => setReportPeriodMonth(Number(e.target.value))}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Year:</label>
                    <select
                      value={reportPeriodYear}
                      onChange={(e) => setReportPeriodYear(Number(e.target.value))}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {Array.from({ length: 15 }, (_, i) => currentYear - 10 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {reportPeriodType === 'Custom' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">From:</label>
                  <input
                    type="date"
                    value={customPeriodFrom}
                    onChange={(e) => setCustomPeriodFrom(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <label className="text-sm font-medium text-slate-600">To:</label>
                  <input
                    type="date"
                    value={customPeriodTo}
                    onChange={(e) => setCustomPeriodTo(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
              )}
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">NBV Opening balance</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accum DEPR opening balance</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">DEPR Charge in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Disposed in the year</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Total Accum DEPR</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodRows.length > 0 ? (
                  periodRows.map((row) => (
                    <tr key={row.category} className="hover:bg-slate-50">
                      <td className="p-4 text-sm font-bold text-slate-800">{row.category}</td>
                      <td className="p-4 text-sm text-right font-medium">₦{row.nbvPrior.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right">₦{row.deprOpening.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right">₦{row.deprCharge.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right text-red-600">₦{row.deprDisposed.toLocaleString()}</td>
                      <td className="p-4 text-sm text-right font-medium">₦{row.deprClosing.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-qet-700 text-right">₦{row.nbvCurrent.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case 'Fully Depreciated Assets':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Original Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Accumulated Depr.</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Salvage Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">NBV at End</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Fully Depreciated Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fullyDepreciated.length > 0 ? (
                fullyDepreciated.map((row) => (
                  <tr key={row.productId} className="hover:bg-slate-50">
                    <td className="p-4 text-sm font-mono text-slate-600">{row.productId}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{row.name}</td>
                    <td className="p-4 text-sm text-slate-600">{row.category}</td>
                    <td className="p-4 text-sm text-right">₦{row.originalCost.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right">₦{row.accumulatedDepreciation.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right">₦{row.salvageValue.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right font-bold">₦{row.nbvAtEnd.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600">{row.fullyDepreciatedDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    {(dateRange.from || dateRange.to) ? (
                      <>No fully depreciated assets in the selected date range. Try adjusting the Report Period (From/To) or clear the dates.</>
                    ) : (
                      <>No fully depreciated assets found matching the selected filters.</>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        );

      case 'Transfer Report':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">From Location</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">To Location</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Custodian</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Action By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferHistory.length > 0 ? (
                transferHistory.map(h => {
                  const asset = assets.find(a => a.id === h.assetId);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm text-slate-600">{h.date}</td>
                      <td className="p-4 text-sm font-mono font-medium text-slate-800">{asset ? asset.productId : 'Unknown'}</td>
                      <td className="p-4 text-sm text-slate-600">{h.fromLocation || '-'}</td>
                      <td className="p-4 text-sm text-qet-700 font-medium flex items-center gap-1"><ArrowRightLeft size={12} /> {h.toLocation || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{h.toCustodian || '-'}</td>
                      <td className="p-4 text-sm text-slate-500">{h.user}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transfer records found.</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'Disposal List':
        return (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Product ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Asset Name</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Category</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Acquisition Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b text-right">Net Book Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Disposal Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase border-b">Mode of Disposal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigateToAsset && onNavigateToAsset(asset.id)}>
                    <td className="p-4 text-sm font-mono text-slate-600 group-hover:text-qet-600 font-bold">{asset.productId}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{asset.name}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.category}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.acquisitionCost.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">₦{asset.netBookValue.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600">{asset.disposalDate || 'N/A'}</td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${asset.disposalMode === 'Sold' ? 'bg-green-100 text-green-700 border-green-200' :
                        asset.disposalMode === 'Donated' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-red-100 text-red-700 border-red-200'
                        }`}>
                        {asset.disposalMode === 'Scrapped' ? <Trash2 size={12} className="mr-1" /> : null}
                        {asset.disposalMode || 'Disposed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No disposed assets found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        );

      default:
        // Generic Fallback
        return (
          <div className="p-8 text-center text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>Select a specific report type to view data.</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-20 md:pb-0">

      {/* Filters Column */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-sm text-slate-500 hover:text-qet-600 transition-colors group self-start"
          >
            <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit overflow-y-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Filter size={20} className="mr-2 text-qet-600" /> Report Filters
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-qet-500 outline-none"
              >
                <option value="Asset Register Summary">Asset Register Summary</option>
                <option value="Full Asset Register">Full Asset Register</option>
                <option value="Fixed Asset Schedule">Fixed Asset Schedule</option>
                <option value="Depreciation Schedule">Depreciation Schedule</option>
                <option value="Fully Depreciated Assets">Fully Depreciated Assets</option>
                <option value="Transfer Report">Transfer Report</option>
                <option value="Disposal List">Disposal List</option>
              </select>
            </div>

            {/* Asset Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Asset Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-qet-500 outline-none"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Asset Location Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-qet-500 outline-none"
              >
                <option value="All">All Locations</option>
                {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Report Period</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-qet-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-qet-500 outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {reportType === 'Fully Depreciated Assets'
                  ? 'Filters by fully depreciated date (when asset reached salvage value).'
                  : 'Filters assets by acquisition date within this period.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Condition & Status</label>

              {/* Quick Groups */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => selectGroup('All')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'All' ? 'bg-qet-50 border-qet-500 text-qet-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>All</button>
                <button onClick={() => selectGroup('Operational')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Operational' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Active</button>
                <button onClick={() => selectGroup('Maintenance')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Maintenance' ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Issue</button>
                <button onClick={() => selectGroup('Disposed')} className={`flex-1 py-1 text-xs rounded border ${filterStatusGroup === 'Disposed' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>Disp</button>
              </div>

              {/* Detailed Checkboxes */}
              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-100 rounded p-2 bg-slate-50">
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Operational (Active)</p>
                {OPERATIONAL_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-qet-600 focus:ring-qet-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}

                <p className="text-[10px] uppercase text-slate-400 font-bold mt-2 mb-1">Maintenance / Repair</p>
                {MAINTENANCE_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-amber-600 focus:ring-amber-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}

                <p className="text-[10px] uppercase text-slate-400 font-bold mt-2 mb-1">Disposal</p>
                {DISPOSED_CODES.map(code => (
                  <label key={code} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={selectedConditions.includes(code)} onChange={() => toggleCondition(code)} className="rounded text-red-600 focus:ring-red-500" />
                    <span className="text-xs text-slate-700 font-medium w-6">{code}</span>
                    <span className="text-xs text-slate-500 truncate">{CONDITION_DESCRIPTIONS[code]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full py-2 bg-qet-600 text-white rounded-lg font-medium hover:bg-qet-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" /> Generating...
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview Column */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-start gap-4">
            <img
              src="/qet-logo-transparent.svg"
              alt="QET Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Analytics & Reports</h1>
              <p className="text-sm text-slate-500">
                {reportType === 'Fully Depreciated Assets' ? fullyDepreciated.length : reportType === 'Fixed Asset Schedule' || reportType === 'Depreciation Schedule' ? periodScheduleByCategory.length : filteredAssets.length} Records • Status: <span className="font-semibold text-qet-600">{filterStatusGroup}</span>
                {(dateRange.from || dateRange.to) ? <span className="ml-2 font-medium text-slate-600">• Report period: {dateRange.from || '…'} to {dateRange.to || '…'}</span> : ''}
                {filterCategory !== 'All' ? <span className="ml-2 font-medium text-slate-600">• {filterCategory}</span> : ''}
                {filterLocation !== 'All' ? <span className="ml-2 font-medium text-slate-600">• {filterLocation}</span> : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
              className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="excel">CSV (spreadsheet)</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              disabled={isExporting || isGenerating}
              className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
              {isExporting ? 'Exporting...' : `Export to ${exportFormat === 'pdf' ? 'PDF' : 'CSV'}`}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg relative mb-4">
          {isGenerating ? (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-qet-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Generating report data...</p>
            </div>
          ) : null}

          {renderReportTable()}

        </div>

        {/* Status Index / Legend */}
        {(reportType === 'Asset Register Summary' || reportType === 'Full Asset Register') && (
          <div className="mt-auto border-t border-slate-100 pt-4 bg-slate-50/50 -mx-6 -mb-6 px-6 pb-6">
            <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center">
              <FileText size={14} className="mr-1" /> Status Index Key
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              {Object.entries(CONDITION_DESCRIPTIONS).map(([code, desc]) => (
                <div key={code} className="flex items-center">
                  <span className={`inline-block w-8 text-center font-bold px-1 py-0.5 rounded border mr-2 flex-shrink-0 ${getBadgeColor(code as ConditionCode)}`}>
                    {code}
                  </span>
                  <span className="text-slate-600 truncate" title={desc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
