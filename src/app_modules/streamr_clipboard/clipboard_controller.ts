import log from 'electron-log';
import path from 'path';
import { EventEmitter } from 'events';
import { FurtherExtendedClipboard } from './clipboard_extended_further';
import { app, NativeImage, nativeImage } from 'electron';
import { FileMessage, ImageMessage, Message, TextMessage } from './types';

class ClipboardController extends EventEmitter {
  private clipboard: FurtherExtendedClipboard;
  private latestContents?: Message;
  private silence: boolean;

  constructor() {
    super();
    // To avoid clipboard functionality breaking bug on linux, we need to require after electron app is ready
    // TODO: find a better solution
    const { clipboard } = require('./clipboard_extended_further');
    this.clipboard = clipboard;
    this.clipboard.on('text-changed', this.textChangedHandlerBase.bind(this));
    this.clipboard.on('image-changed', this.imageChangedHandlerBase.bind(this));
    this.clipboard.on('file-changed', this.fileChangedHandlerBase.bind(this));
    this.clipboard.startWatching();
    this.silence = false;
  }

  destroy() {
    this.removeAllListeners();
    this.clipboard.off('text-changed', this.textChangedHandlerBase.bind(this));
    this.clipboard.off('image-changed', this.imageChangedHandlerBase.bind(this));
    this.clipboard.off('file-changed', this.fileChangedHandlerBase.bind(this));
    this.clipboard.stopWatching();
    log.debug('clipboard controller destroyed');
  }
  fileChangedHandlerBase() {
    log.debug('clipboardController file changed');
    const { fullPath, fileName } = this.readFile();
    if (this.silence) return log.debug('clipboard file handler silenced');
    const payload: FileMessage = { type: 'file', fullPath, fileName };
    this.latestContents = payload;
    // macos handles clipboard differently and copies filename and icon as text and image, therefore
    // we silence the controller so that the file event doesnt get overridden the other events
    this.silence = true;
    setTimeout(() => {
      this.silence = false;
    }, 700);
    this.emit('file', payload);
    this.emit('any', payload);
  }

  textChangedHandlerBase() {
    log.debug('clipboardController text changed');
    if (this.silence) return log.debug('clipboard text handler silenced');
    const payload: TextMessage = { type: 'text', body: this.readText() };
    this.latestContents = payload;
    this.emit('image', payload);
    this.emit('any', payload);
  }

  async imageChangedHandlerBase(img: NativeImage) {
    log.debug('clipboardController image changed');
    if (this.silence) return log.debug('clipboard image handler silenced');
    const msg: ImageMessage = { type: 'image', body: img };
    this.latestContents = msg;
    this.emit('image', msg);
    this.emit('any', msg);
  }

  getLatestContents(): Message | undefined {
    return this.latestContents;
  }

  readFile(): FileMessage {
    const fullPath = this.clipboard.readFile()?.replace(/\0+$/, '') || ''; //TODO: dont leave like this
    const fileName = path.basename(fullPath);
    return { type: 'file', fullPath, fileName };
  }

  readText(): string {
    return this.clipboard.readText();
  }

  writeText(text: string) {
    this.clipboard.writeText(text);
  }

  async write(msg: ImageMessage | TextMessage, { deactivateHandler = true }: { deactivateHandler?: boolean } = {}) {
    if (deactivateHandler) {
      this.silence = true;
      setTimeout(() => {
        this.silence = false;
      }, 500);
    }
    switch (msg.type) {
      case 'text':
        this.writeText(msg.body);
        break;
      case 'image':
        await this.writeImage(msg);
        break;
      default:
        const _exhaustiveCheck: never = msg;
        return;
    }
  }

  async writeImage(msg: ImageMessage) {
    try {
      let imgData: NativeImage;
      if (typeof msg.body === 'string') {
        imgData = nativeImage.createFromDataURL(msg.body);
      } else {
        imgData = msg.body;
      }
      this.clipboard.writeImage(imgData);
    } catch (err) {
      log.error('writeImage failed', err);
    }
  }
}

export { ClipboardController };
