// Using github.com/arjun-g/electron-clipboard-extended as the base

import { clipboard as clipb } from 'electron';
import EventEmitter from 'events';

export interface FurtherExtendedClipboard extends Electron.Clipboard {
  readFile(): string | null;
  on(event: string, listener: (...args: any[]) => void): Electron.Clipboard;
  once(event: string, listener: (...args: any[]) => void): Electron.Clipboard;
  off(event: string, listener?: (...args: any[]) => void): Electron.Clipboard;
  startWatching(): Electron.Clipboard;
  stopWatching(): Electron.Clipboard;
}

export const clipboard = clipb as FurtherExtendedClipboard;

const clipboardEmitter = new EventEmitter();

clipboard.readFile = (): string | null => {
  let filePath: string | null = null;

  if (process.platform === 'darwin') {
    filePath = clipboard.read('public.file-url');
  } else {
    filePath = clipboard.readBuffer('FileNameW').toString('ucs2');
  }

  return filePath;
};

let watcherId: NodeJS.Timeout | null = null;
let previousText: string = clipboard.readText();
let previousImage = clipboard.readImage();
let previousFile = clipboard.readFile();
const WATCHER_MIN_INTERVAL = 500;

clipboard.on = (event: string, listener: (...args: any[]) => void) => {
  clipboardEmitter.on(event, listener);
  return clipboard;
};

clipboard.once = (event: string, listener: (...args: any[]) => void) => {
  clipboardEmitter.once(event, listener);
  return clipboard;
};

clipboard.off = (event: string, listener?: (...args: any[]) => void) => {
  if (listener) {
    clipboardEmitter.removeListener(event, listener);
  } else {
    clipboardEmitter.removeAllListeners(event);
  }
  return clipboard;
};

clipboard.startWatching = () => {
  if (!watcherId) {
    let timeoutLength = WATCHER_MIN_INTERVAL;
    const watcher = () => {
      if (isDiffText(previousText, (previousText = clipboard.readText()))) {
        clipboardEmitter.emit('text-changed');
      }

      // Loading large images (megabytes of data) from clipboard can take
      // a long time, therefore we try to optimize it. When image seems large
      // based on the readImage time, we use a faster processing for the image.
      // The tradeoff is, that we might not recognize a changed image from
      // two very similar images. However, most of the time that is not the
      // case, and speed-up from seconds to milliseconds is critical since
      // it blocks the js execution. Here's the work-around.

      const t0 = performance.now();
      const img = clipboard.readImage();
      const t1 = performance.now();
      const elapsedTime = t1 - t0;

      let isDiff;
      if (elapsedTime < 200) {
        timeoutLength = WATCHER_MIN_INTERVAL;
        isDiff = isDiffImage(previousImage, (previousImage = img));
      } else {
        timeoutLength = elapsedTime * 2;
        isDiff = isDiffImageFastAndDirty(previousImage, (previousImage = img));
      }
      if (isDiff) {
        clipboardEmitter.emit('image-changed', img);
      }

      if (isDiffFile(previousFile, (previousFile = clipboard.readFile()))) {
        clipboardEmitter.emit('file-changed');
      }
      watcherId = setTimeout(watcher, timeoutLength);
    };
    watcherId = setTimeout(watcher, timeoutLength);
  }
  return clipboard;
};

clipboard.stopWatching = () => {
  if (watcherId) clearTimeout(watcherId);
  watcherId = null;
  return clipboard;
};

function isDiffImageFastAndDirty(img1: Electron.NativeImage, img2: Electron.NativeImage): boolean {
  if (img2.isEmpty()) {
    return false;
  }
  const img2bitmap = img2.getBitmap();
  const img1bitmap = img1.getBitmap();
  if (img2bitmap.length !== img1bitmap.length) {
    // different lengths
    return true;
  }
  const len = img1bitmap.length;
  for (let i = 0; i < 100; i++) {
    const randIdx = Math.floor(Math.random() * len);
    if (img1bitmap[randIdx] !== img2bitmap[randIdx]) {
      // difference found
      return true;
    }
  }
  // all tests pass, therefore conclude that they are probably the same image
  return false;
}

function isDiffText(str1: string, str2: string): boolean {
  return !!str2 && str1 !== str2;
}

function isDiffImage(img1: Electron.NativeImage, img2: Electron.NativeImage): boolean {
  return !img2.isEmpty() && img1.toDataURL() !== img2.toDataURL();
}

function isDiffFile(fil1: string | null, fil2: string | null): boolean {
  return !!fil2 && fil1 !== fil2;
}
