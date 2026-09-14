/**
 * Cross-browser clipboard copy helper that works over HTTP, HTTPS,
 * IP addresses, localhost, and mobile web browsers with fallback.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  // Method 1: Modern navigator.clipboard API (HTTPS or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard failed, attempting fallback...', err);
    }
  }

  // Method 2: Fallback using hidden textarea & document.execCommand('copy') (Works over HTTP & IP addresses)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}
