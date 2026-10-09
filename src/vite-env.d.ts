/// <reference types="vite/client" />

interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorOptions {
  formats?: string[]
}
declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}
