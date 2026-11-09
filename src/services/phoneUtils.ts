/**
 * Phone formatting and URL generation utilities for WhatsApp and SMS
 */

export interface PhoneValidationResult {
  isValid: boolean;
  raw: string;
  cleaned: string;
  formattedInternational: string; // e.g. 905XXXXXXXXX
  formattedSms: string;           // e.g. +905XXXXXXXXX
  error?: string;
}

/**
 * Normalizes and validates Turkish mobile numbers according to specifications:
 * - Removes +90 prefix if present
 * - Removes leading 0 if present
 * - Strips all spaces, brackets, hyphens and non-numeric characters
 * - Ensures number starts with 90 followed by 5XX XXX XX XX (12 digits total)
 */
export function formatPhoneNumber(phone: string | undefined | null): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      raw: phone || '',
      cleaned: '',
      formattedInternational: '',
      formattedSms: '',
      error: 'Telefon numarası girilmemiş.',
    };
  }

  const raw = phone.trim();
  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('90')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // A valid Turkish mobile number starts with 5 and has 10 digits (e.g. 5321234567)
  if (digits.length !== 10 || !digits.startsWith('5')) {
    return {
      isValid: false,
      raw,
      cleaned: digits,
      formattedInternational: '',
      formattedSms: '',
      error: `Geçersiz telefon numarası formatı (${raw}). Lütfen geçerli bir 10 haneli GSM numarası giriniz (örn: 05XXXXXXXXX).`,
    };
  }

  const formattedInternational = `90${digits}`;
  const formattedSms = `+90${digits}`;

  return {
    isValid: true,
    raw,
    cleaned: digits,
    formattedInternational,
    formattedSms,
  };
}

/**
 * Detects if user device is mobile (iOS/Android)
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

/**
 * Builds standard WhatsApp Web link (Method 1 - Preferred on Desktop & iFrame environments):
 * https://web.whatsapp.com/send?phone=905XXXXXXXXX&text=URL_ENCODED_MESSAGE
 */
export function buildWhatsAppWebUrl(phoneValidation: PhoneValidationResult, message: string): string | null {
  if (!phoneValidation.isValid) return null;
  const encodedText = encodeURIComponent(message);
  return `https://web.whatsapp.com/send?phone=${phoneValidation.formattedInternational}&text=${encodedText}`;
}

/**
 * Builds standard wa.me link (Method 2 - Mobile friendly):
 * https://wa.me/905XXXXXXXXX?text=URL_ENCODED_MESSAGE
 */
export function buildWaMeUrl(phoneValidation: PhoneValidationResult, message: string): string | null {
  if (!phoneValidation.isValid) return null;
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${phoneValidation.formattedInternational}?text=${encodedText}`;
}

/**
 * Automatically chooses the primary recommended WhatsApp link based on client platform:
 * - Desktop: WhatsApp Web (avoids wa.me cross-origin frame redirect block)
 * - Mobile: wa.me (opens WhatsApp native app)
 */
export function buildPrimaryWhatsAppUrl(phoneValidation: PhoneValidationResult, message: string): string | null {
  if (isMobileDevice()) {
    return buildWaMeUrl(phoneValidation, message);
  }
  return buildWhatsAppWebUrl(phoneValidation, message);
}

/**
 * Builds SMS URI:
 * sms:+905XXXXXXXXX?body=URL_ENCODED_MESSAGE
 */
export function buildSmsUrl(phoneValidation: PhoneValidationResult, message: string): string | null {
  if (!phoneValidation.isValid) return null;
  const encodedBody = encodeURIComponent(message);
  return `sms:${phoneValidation.formattedSms}?body=${encodedBody}`;
}
