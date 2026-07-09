const crypto = require('crypto');

const escapePdfText = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

class InvoicePDFGenerator {
  async generate(invoice, options = {}) {
    const lines = this.buildLines(invoice, options);
    const pdf = this.renderSimplePdf(lines);
    const buffer = Buffer.from(pdf, 'binary');

    return {
      buffer,
      contentType: 'application/pdf',
      fileName: `${invoice.invoiceNumber}.pdf`,
      template: options.template || 'standard',
      checksum: crypto.createHash('sha256').update(buffer).digest('hex')
    };
  }

  buildLines(invoice) {
    return [
      'Harglim Publishers',
      `Invoice: ${invoice.invoiceNumber}`,
      `Generated: ${new Date(invoice.generatedAt || Date.now()).toISOString()}`,
      `Order: ${invoice.orderNumber || invoice.order}`,
      `Payment: ${invoice.payment}`,
      `Customer: ${invoice.customerName || invoice.customer}`,
      '',
      'Items',
      ...invoice.items.map((item) => `${item.title} x ${item.quantity} @ ${item.unitPrice} = ${item.lineTotal}`),
      '',
      `Subtotal: ${invoice.subtotal}`,
      `Tax: ${invoice.taxTotal}`,
      `Discount: ${invoice.discountTotal}`,
      `Shipping: ${invoice.shippingTotal}`,
      `Total: ${invoice.total} ${invoice.currency || 'INR'}`
    ];
  }

  renderSimplePdf(lines) {
    const contentLines = [
      'BT',
      '/F1 11 Tf',
      '50 780 Td',
      ...lines.flatMap((line, index) => {
        const command = index === 0 ? [] : ['0 -18 Td'];
        return [...command, `(${escapePdfText(line)}) Tj`];
      }),
      'ET'
    ];
    const stream = contentLines.join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(stream, 'binary')} >> stream\n${stream}\nendstream endobj`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'binary'));
      pdf += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'binary');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }
}

module.exports = new InvoicePDFGenerator();
module.exports.InvoicePDFGenerator = InvoicePDFGenerator;
