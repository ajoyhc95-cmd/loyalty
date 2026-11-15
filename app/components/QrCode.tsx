"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, label }: { value: string; label?: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 168, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (active) setImage(url); })
      .catch(() => { if (active) setError("QR code could not be generated."); });
    return () => { active = false; };
  }, [value]);

  if (error) return <span className="qr-error">{error}</span>;
  if (!image) return <span className="qr-loading" aria-label="Generating QR code" />;
  return <img className="qr-image" src={image} alt={label ?? `QR code for ${value}`} />;
}
