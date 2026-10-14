import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';

export async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

export async function getCroppedImg(imageSrc: string, pixelCrop: Area, maxSize = 380): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Downscale directly on canvas for an avatar-optimal square dimension (max 380x380 px)
  // This automatically produces crisp output while keeping file size very small (<40KB)
  const outputSize = Math.min(maxSize, Math.max(pixelCrop.width, 120));
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return canvas.toDataURL('image/jpeg', 0.82);
}

interface ImageCropperModalProps {
  image: string;
  onCancel: () => void;
  onDone: (res: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ image, onCancel, onDone }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_a: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const showResult = async () => {
    try {
      if (!croppedAreaPixels) {
        onDone(image);
        return;
      }
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onDone(croppedImage || image);
    } catch (e) {
      console.error("Cropping failed, falling back to original image:", e);
      onDone(image);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="h-16 flex items-center justify-between px-6 bg-black/60 backdrop-blur-md z-10">
        <button onClick={onCancel} className="text-white text-sm font-bold uppercase tracking-widest">
          Cancel
        </button>
        <h3 className="text-white text-sm font-bold uppercase tracking-widest">Crop Image</h3>
        <button onClick={showResult} className="text-[#FF8FA3] text-sm font-bold uppercase tracking-widest">
          Done
        </button>
      </div>

      <div className="relative flex-1 bg-[#1a1a1a]">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          cropShape="round"
          showGrid={false}
        />
      </div>

      <div className="h-24 px-10 flex items-center bg-black/80 z-10">
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-[#FF8FA3]"
        />
      </div>
    </div>
  );
};
