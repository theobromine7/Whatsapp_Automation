import QRCode from "qrcode";

export interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount?: number;
  note?: string;
}

/**
 * Build a UPI deep-link string.
 * Format: upi://pay?pa=<upiId>&pn=<name>&am=<amount>&cu=INR&tn=<note>
 */
export function buildUpiLink(params: UpiPaymentParams): string {
  const { upiId, payeeName, amount, note } = params;
  const url = new URL("upi://pay");
  url.searchParams.set("pa", upiId);
  url.searchParams.set("pn", payeeName);
  url.searchParams.set("cu", "INR");
  if (amount && amount > 0) url.searchParams.set("am", String(amount));
  if (note) url.searchParams.set("tn", note.substring(0, 50));
  return url.toString();
}

/**
 * Generate a QR code PNG buffer for a UPI payment.
 */
export async function generateUpiQr(params: UpiPaymentParams): Promise<Buffer> {
  const upiLink = buildUpiLink(params);
  const buffer = await QRCode.toBuffer(upiLink, {
    type: "png",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return buffer;
}
