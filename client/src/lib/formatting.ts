
import { ethers } from 'ethers';

/**
 * Format token amounts from wei to readable format
 */
export function formatTokenAmount(amount: string | bigint | number, decimals: number = 18, maxDecimals: number = 6): string {
  if (!amount) return '0';

  try {
    // Validate decimals
    const validDecimals = Math.min(Math.max(0, Math.floor(decimals)), 18);
    
    // Format the amount
    let formattedAmount = ethers.formatUnits(amount.toString(), validDecimals);
    
    // Limit decimal places for display
    const parts = formattedAmount.split('.');
    if (parts.length > 1 && parts[1].length > maxDecimals) {
      formattedAmount = `${parts[0]}.${parts[1].substring(0, maxDecimals)}`;
    }
    
    // Remove trailing zeros
    formattedAmount = formattedAmount.replace(/\.?0+$/, '');
    
    return formattedAmount;
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
}

/**
 * Format USD value
 */
export function formatUSD(amount: number | string, minimumFractionDigits: number = 2, maximumFractionDigits: number = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(num);
}

/**
 * Format number with comma separators and specified decimal places
 */
export function formatNumber(value: number | string, minimumFractionDigits: number = 0, maximumFractionDigits: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(num);
}

/**
 * Format currency value
 */
export function formatCurrency(value: number | string, currency: string = 'USD', minimumFractionDigits: number = 2, maximumFractionDigits: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(num);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | string, minimumFractionDigits: number = 2, maximumFractionDigits: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(num / 100);
}
