export const escapePrintHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * طباعة وثيقة HTML جاهزة عبر iframe مخفي يحترم قاعدة @page بالمقاس الدقيق بالملليمتر
 */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc && iframe.contentWindow) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow.focus();
    window.setTimeout(() => {
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 120);
  } else {
    document.body.removeChild(iframe);
    window.print();
  }
}
