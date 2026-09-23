'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (scannedCode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission_denied' | 'insecure_origin' | 'generic' | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const regionId = 'barcode-camera-scanner-region';

  const isIOS = typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isInsecureContext =
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  // Helper function to stop hardware camera stream tracks completely & wipe duplicate video nodes
  const stopCameraHardware = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }

    const region = document.getElementById(regionId);
    if (region) {
      const videos = region.getElementsByTagName('video');
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          video.srcObject = null;
        }
      }
      region.innerHTML = ''; // Wipe duplicate video elements
    }
  };

  const startScanner = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setErrorMsg(null);
    setErrorType(null);
    setIsRequestingPerm(true);

    try {
      // 1. Wipe any pre-existing camera streams or duplicate video nodes
      await stopCameraHardware();

      // 2. Request media permissions explicitly
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          stream.getTracks().forEach((t) => t.stop());
        } catch (permErr: any) {
          console.warn('[getUserMedia permission check error]:', permErr);
          if (isInsecureContext) {
            setErrorType('insecure_origin');
            setErrorMsg('iOS Safari blocks camera access on non-HTTPS origins (http:// on IP address).');
            setIsRequestingPerm(false);
            isStartingRef.current = false;
            return;
          }
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setErrorType('permission_denied');
            setErrorMsg('Camera access was denied by your browser or iOS settings.');
            setIsRequestingPerm(false);
            isStartingRef.current = false;
            return;
          }
        }
      }

      // 3. Find back camera device ID if available for best focus on mobile
      let cameraConfig: any = { facingMode: 'environment' };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          if (backCam) {
            cameraConfig = { deviceId: { exact: backCam.id } };
          } else {
            cameraConfig = { deviceId: { exact: devices[devices.length - 1].id } };
          }
        }
      } catch (e) {
        console.warn('Get cameras error, falling back to facingMode:', e);
      }

      // 4. Initialize single Html5Qrcode instance
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const html5Qrcode = new Html5Qrcode(regionId, {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5Qrcode;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdgePercentage = 0.85;
        const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxWidth = Math.max(Math.floor(minEdgeSize * minEdgePercentage), 240);
        const qrboxHeight = Math.max(Math.floor(qrboxWidth * 0.55), 140);
        return { width: qrboxWidth, height: qrboxHeight };
      };

      await html5Qrcode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (decodedText) {
            if (navigator.vibrate) {
              try {
                navigator.vibrate(100);
              } catch (e) {
                // ignore
              }
            }
            stopCameraHardware();
            onScanSuccess(decodedText);
          }
        },
        () => {
          // Per frame scan callback
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (isInsecureContext) {
        setErrorType('insecure_origin');
        setErrorMsg('iOS Safari blocks camera access on non-HTTPS origins.');
      } else if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission') || err?.message?.includes('denied')) {
        setErrorType('permission_denied');
        setErrorMsg('Camera access was denied by browser or iOS settings.');
      } else {
        setErrorType('generic');
        setErrorMsg(err?.message || 'Unable to access camera on this device.');
      }
    } finally {
      setIsRequestingPerm(false);
      isStartingRef.current = false;
    }
  };

  useEffect(() => {
    startScanner();

    return () => {
      stopCameraHardware();
    };
  }, []);

  const handleClose = async () => {
    await stopCameraHardware();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Global CSS to prevent duplicate video projections */}
      <style jsx global>{`
        #barcode-camera-scanner-region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #barcode-camera-scanner-region video:nth-of-type(n+2) {
          display: none !important;
        }
        #barcode-camera-scanner-region canvas {
          display: none !important;
        }
      `}</style>

      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <Camera className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-slate-900 text-base">Barcode Scanner</span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 transition"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Container / Error Guidance */}
        {!errorMsg ? (
          <div className="relative w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center min-h-[300px]">
            <div id={regionId} className="w-full h-full" />

            {/* Viewfinder Overlay */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-72 h-40 border-2 border-indigo-400 rounded-2xl relative shadow-[0_0_25px_rgba(99,102,241,0.5)] animate-pulse">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />
                  {/* Red Laser Line */}
                  <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] absolute top-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-xs font-bold text-slate-100 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-700 backdrop-blur-md">
                  Align EAN/UPC barcode inside red laser frame
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Detailed Error & Guidance UI */
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="w-7 h-7 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Camera Permission Required</h3>
                <p className="text-xs text-slate-600">{errorMsg}</p>
              </div>
            </div>

            {/* Insecure origin notice */}
            {errorType === 'insecure_origin' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold">⚠️ iOS Security Policy:</p>
                <p className="text-[11px] text-rose-700">
                  iOS Safari blocks camera access on HTTP URLs (e.g. <code>http://192.168.x.x</code>). Please access via <code>https://</code> or test on <code>localhost</code>.
                </p>
              </div>
            )}

            {/* iOS Safari Step-by-Step Guide */}
            {isIOS && errorType === 'permission_denied' && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5 text-xs text-slate-700 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-indigo-600">
                  <Smartphone className="w-4 h-4" />
                  <span>How to Enable Camera on iPhone (Safari):</span>
                </div>
                <ol className="space-y-2 text-[11px] text-slate-600 list-decimal list-inside pl-1">
                  <li>
                    Tap the <strong>"aA"</strong> or <strong>Page Settings</strong> icon on the left of the Safari address bar.
                  </li>
                  <li>
                    Select <strong>Website Settings</strong>.
                  </li>
                  <li>
                    Tap <strong>Camera</strong> and set it to <strong>Allow</strong>.
                  </li>
                  <li>
                    <em>Or in iOS Settings:</em> Open <strong>Settings ➔ Safari ➔ Camera ➔ Allow</strong>.
                  </li>
                </ol>
              </div>
            )}

            {/* Retry Permission Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={startScanner}
                disabled={isRequestingPerm}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {isRequestingPerm ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>Request Permission & Try Camera Again</span>
              </button>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Enter Barcode Manually
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="mt-4 text-xs text-slate-400">
          Point camera at barcode. Product info will be fetched automatically via API.
        </p>
      </div>
    </div>
  );
}
