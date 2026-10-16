export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

/**
 * Universal copy to clipboard utility with fallback for non-secure contexts (LAN IPs over HTTP).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const str = String(text ?? '');
  if (!str) return false;

  // 1. Try modern Async Clipboard API if available
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {
      // Fall through to execCommand
    }
  }

  // 2. Fallback using temporary textarea (works on HTTP IP addresses e.g. 192.168.x.x)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = str;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text using fallback:', err);
    return false;
  }
}
