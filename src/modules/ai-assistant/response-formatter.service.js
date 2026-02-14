/**
 * Response Formatter Service
 * Formats AI responses for WhatsApp messaging
 */

export class ResponseFormatterService {
  /**
   * Format AI response for WhatsApp
   * @param {Object} aiResponse - AI response object
   */
  formatForWhatsApp(aiResponse) {
    let content = aiResponse.content;

    // Ensure response is under 3000 characters (WhatsApp limit is 4096, but leave buffer)
    if (content.length > 3000) {
      content = content.substring(0, 2950) + '\n\n... (response truncated)';
    }

    // Replace markdown code blocks with WhatsApp-friendly format
    content = content.replace(/```(.*?)\n/g, '---\n');
    content = content.replace(/```/g, '---');

    // Replace markdown bold with WhatsApp bold
    content = content.replace(/\*\*(.*?)\*\*/g, '*$1*');

    // Ensure proper line breaks
    content = content.replace(/\n{3,}/g, '\n\n');

    return content;
  }

  /**
   * Format data as table for WhatsApp
   */
  formatAsTable(headers, rows) {
    let table = '';

    // Headers
    table += '*' + headers.join(' | ') + '*\n';
    table += '-'.repeat(40) + '\n';

    // Rows
    rows.forEach((row) => {
      table += row.join(' | ') + '\n';
    });

    return table;
  }

  /**
   * Format list for WhatsApp
   */
  formatAsList(items, numbered = true) {
    return items
      .map((item, index) => {
        const prefix = numbered ? `${index + 1}. ` : '• ';
        return `${prefix}${item}`;
      })
      .join('\n');
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount, currency = 'INR') {
    if (currency === 'INR') {
      return `₹${this.formatNumber(amount)}`;
    }
    return `${currency} ${this.formatNumber(amount)}`;
  }

  /**
   * Format number with commas
   */
  formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
