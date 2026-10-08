const apiPhotoBytes = 2.8 * 1024 * 1024;

function base64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

async function decodedImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function photoForApi(file: File): Promise<{ mime: string; data: string }> {
  if (file.size <= apiPhotoBytes) return { mime: file.type, data: await base64(file) };
  const image = await decodedImage(file);
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
  const initialScale = Math.min(1, 4000 / maxDimension);
  for (const factor of [1, 0.85, 0.7, 0.55]) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * initialScale * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * initialScale * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat diproses pada perangkat ini.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= apiPhotoBytes) return { mime: 'image/jpeg', data: await base64(blob) };
    }
  }
  throw new Error('Foto terlalu rumit untuk diunggah. Coba foto lain atau kecilkan resolusinya.');
}
