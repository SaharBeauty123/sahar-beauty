const WEBSITE_URL = 'https://saharbeauty12.netlify.app';
const WAZE_URL = 'https://waze.com/ul/hsv8ysp79k';
const WHATSAPP_FOOTER = 'Sahar Beauty 🤎';

function withWhatsAppFooter(message) {
  return `${String(message || '').trim()}\n\n${WHATSAPP_FOOTER}`;
}

module.exports = {
  WEBSITE_URL,
  WAZE_URL,
  WHATSAPP_FOOTER,
  withWhatsAppFooter
};
