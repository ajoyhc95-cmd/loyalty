"use client";

import { useEffect, useRef, useState } from "react";

type DetectedBarcode = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type DetectorConstructor = new (options?: { formats: string[] }) => Detector;

export function BarcodeScanner({ onScan }: { onScan: (value: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let frame = 0;
    const detectorConstructor = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost.");
        if (!detectorConstructor) throw new Error("This browser does not support barcode scanning. Enter the code manually.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new detectorConstructor({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onScan(codes[0].rawValue);
              setActive(false);
              return;
            }
          } catch {
            setError("Could not read the barcode. Adjust the camera and try again.");
          }
          frame = window.requestAnimationFrame(scan);
        };
        frame = window.requestAnimationFrame(scan);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not open the camera.");
        setActive(false);
      }
    }
    void start();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, onScan]);

  return (
    <div className="scanner-wrap">
      <button className="button button-muted button-small" type="button" onClick={() => { setError(""); setActive((value) => !value); }}>
        {active ? "Stop camera" : "Scan code"}
      </button>
      {active && <video className="scanner-video" ref={videoRef} muted playsInline aria-label="Barcode scanner camera" />}
      {error && <p className="field-note error-text">{error}</p>}
    </div>
  );
}
