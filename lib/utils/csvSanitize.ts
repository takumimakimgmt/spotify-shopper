/**
 * Sanitize cell value for CSV export to prevent formula injection attacks.
 * If cell starts with =, +, -, or @, prefix with single quote to neutralize.
 */
export function sanitizeForCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  const firstChar = str.charAt(0);
  
  // Formula injection dangerous chars
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    return `'${str}`;
  }
  
  return str;
}
