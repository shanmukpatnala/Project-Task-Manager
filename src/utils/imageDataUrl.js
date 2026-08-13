const IMAGE_FILE_EXTENSION = /\.(apng|avif|bmp|gif|heic|heif|jpe?g|png|webp|svg)$/i;

export const sanitizeImageDataUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("data:image/") || value.startsWith("http"))
    ? value
    : "";

export const imageFileToDataUrl = (file, maxSize = 320) =>
  new Promise((resolve, reject) => {
    const isImageFile =
      file?.type?.startsWith("image/") || IMAGE_FILE_EXTENSION.test(file?.name || "");

    if (!isImageFile) {
      reject(new Error("Please upload an image file."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.onload = () => {
      const source = sanitizeImageDataUrl(String(reader.result || ""));

      if (!source) {
        reject(new Error("Image upload failed."));
        return;
      }

      if (file.type === "image/svg+xml") {
        resolve(source);
        return;
      }

      const image = new Image();
      image.onerror = () => resolve(source);
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = source;
    };

    reader.readAsDataURL(file);
  });
