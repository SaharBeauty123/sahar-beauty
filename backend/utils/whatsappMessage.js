const WHATSAPP_FOOTER = 'Sahar Beauty ✨\nאיפור כלות ואירועים באהבה ובדיוק\n\nWebsite: https://saharbeauty12.netlify.app\nInstagram: https://www.instagram.com/11saharbeauty\nWaze: https://waze.com/ul/hsvbbm6j5p';

function withWhatsAppFooter(message) {
  return `${String(message || '').trim()}\n\n${WHATSAPP_FOOTER}`;
}

module.exports = {
  WHATSAPP_FOOTER,
  withWhatsAppFooter
};
