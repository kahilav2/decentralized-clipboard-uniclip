import { app, Notification } from 'electron';
import log from 'electron-log';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { checkFileExists } from '../../tools';
import { Config } from './config_controller';
import { FileMessage, ImageMessage, isMessage, Message } from './types';

interface FileMessageReceiving {
  type: 'file';
  body: string;
  fileName: string;
  deviceId: string;
}

function isFileMessageReceiving(msg: unknown): msg is FileMessageReceiving {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  const fileMsg = msg as FileMessageReceiving;
  return (
    typeof fileMsg.type === 'string' &&
    fileMsg.type === 'file' &&
    typeof fileMsg.body === 'string' &&
    typeof fileMsg.fileName === 'string'
  );
}

class StreamrMessageController extends EventEmitter {
  private deviceId: string;
  private receivedMessages: Message[];
  private sentMessages: Message[];
  private tempCounter = 0;

  constructor(config: Partial<Config>) {
    super();
    if (config.deviceId) {
      this.deviceId = config.deviceId;
    } else throw new Error('StreamrMessageController improperly initialized');
    this.receivedMessages = [];
    this.sentMessages = [];
  }

  destroy() {
    this.removeAllListeners();
  }
  async receive(msg: unknown) {
    log.debug('Message received');
    if (isFileMessageReceiving(msg)) {
      const { fileCreated, destination } = await this.saveFile(msg);
      if (fileCreated) {
        this.emit('file-created', msg);
      }
      const conv: FileMessage = {
        fileName: msg.fileName,
        fullPath: destination || '',
        type: msg.type
      };

      msg = conv;
    }
    if (!isMessage(msg)) {
      log.debug('unsupported message format');
      return;
    }

    this.receivedMessages.push(msg);
    this.emit('message', msg);
    if (msg.type === 'image') this.emit('image', msg);
    if (msg.type === 'text') this.emit('text', msg);
    if (msg.type === 'file') this.emit('file', msg);
  }

  async saveFile(msg: FileMessageReceiving): Promise<{ fileCreated: boolean; destination: string }> {
    //TODO: remove app and get the path as parameter
    const destination = path.join(app.getPath('documents'), 'uniclip', msg.fileName);
    const fileExists = await checkFileExists(destination);
    if (fileExists) {
      log.debug(destination, 'already exists');
      return { fileCreated: false, destination };
    }

    await fs.writeFile(destination, msg.body, { encoding: 'base64' });
    log.debug('wrote to', destination);
    return { fileCreated: true, destination };
  }

  getLatestImage() {
    return this.getLatest('image');
  }

  getLatestText() {
    return this.getLatest('text');
  }

  getLatestFile() {
    return this.getLatest('file');
  }

  getLatestMessages({ amount } = { amount: 5 }) {
    return this.receivedMessages.slice(-amount);
  }

  getLatest(type: string) {
    const filtered = this.receivedMessages.filter((m) => m.type === type);
    return filtered.length > 0 ? filtered.reduce((_, m) => m) : undefined;
  }

  async upload(msg: Message) {
    this.sentMessages.shift();
    this.sentMessages.push(msg);
    switch (msg.type) {
      case 'text':
        await this.uploadText(msg.body);
        break;
      case 'image':
        await this.uploadImage(msg);
        break;
      case 'file':
        await this.uploadFile(msg);
        break;
      default:
        const _exhaustiveCheck: never = msg;
    }
  }

  async uploadFile(msg: FileMessage) {
    try {
      let p = msg.fullPath;
      if (p.startsWith('file:')) {
        log.debug('handling url');
        p = url.fileURLToPath(p);
      }
      const base64file = await fs.readFile(p, { encoding: 'base64' });
      const msgObj = {
        type: 'file',
        fileName: msg.fileName,
        body: base64file
      };
      await this.emit('publish', msgObj);
    } catch (err) {
      log.error('uploadFile', err);
    }
  }

  async uploadImage(msg: ImageMessage) {
    let imgBase64: string;
    if (typeof msg.body === 'string') {
      imgBase64 = msg.body;
    } else {
      imgBase64 = msg.body.toDataURL();
    }
    const msgObj = {
      type: 'image',
      body: imgBase64
    };
    await this.emit('publish', msgObj);
  }

  async uploadText(text: string) {
    log.debug('uploading text: ', text);
    await this.emit('publish', {
      type: 'text',
      body: text,
      deviceId: this.deviceId
    });
  }
}

export { StreamrMessageController };
