const SEATS_QR_URL_PATTERN =
  /^https?:\/\/seatssoftware\.com\/qr\/(\d{6})(?:[/?#].*)?$/i;
const SEATS_CODE_PATTERN = /^(\d{6})$/;

export function extractSeatsCode(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  const codeMatch = trimmedValue.match(SEATS_CODE_PATTERN);

  if (codeMatch) {
    return codeMatch[1];
  }

  const urlMatch = trimmedValue.match(SEATS_QR_URL_PATTERN);

  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}
