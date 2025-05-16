// lib/formatters/business.ts
/**
 * Converts a business type code to a human-readable format
 * @param type The business type code from Footprint (e.g., 'llc', 'c_corporation')
 * @returns Formatted business type name
 */
export function formatBusinessType(type: string): string {
  const typeMap: Record<string, string> = {
    c_corporation: 'C Corporation',
    s_corporation: 'S Corporation',
    b_corporation: 'B Corporation',
    llc: 'Limited Liability Company',
    llp: 'Limited Liability Partnership',
    partnership: 'Partnership',
    sole_proprietorship: 'Sole Proprietorship',
    non_profit: 'Non-Profit',
    trust: 'Trust',
    agent: 'Agent',
    unknown: 'Unknown',
  };

  return typeMap[type] || type;
}

/**
 * Converts a document name from snake_case to Title Case
 * @param docType Document type identifier (e.g., 'proof_of_business_address')
 * @returns Formatted document name (e.g., 'Proof Of Business Address')
 */
export function formatDocumentName(docType: string): string {
  // Convert snake_case to Title Case with spaces
  return docType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
