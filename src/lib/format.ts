
import { parseISO } from 'date-fns';

export const safeParseDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  
  if (typeof date === 'string') {
    if (date === 'unknown') return new Date();
    try {
      const parsed = parseISO(date);
      if (!isNaN(parsed.getTime())) return parsed;
    } catch (e) {
      // fall through
    }
    const fallback = new Date(date);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  
  if (date && typeof date === 'object') {
    if (typeof date.toDate === 'function') return date.toDate();
    if (typeof date.seconds === 'number') return new Date(date.seconds * 1000);
  }
  
  const final = new Date(date);
  return isNaN(final.getTime()) ? new Date() : final;
};

export const formatCurrency = (val: number) => {
  return `Rp${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatCurrencyStrict = (val: number) => {
  return `Rp${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (val: string) => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '');
  if (!clean) return '';
  return parseInt(clean, 10).toLocaleString('id-ID');
};

export const getCleanNumber = (val: string) => {
  return val.replace(/\D/g, '');
};
