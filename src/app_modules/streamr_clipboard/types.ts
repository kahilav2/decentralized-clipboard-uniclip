interface FileMessage {
  type: 'file';
  fullPath: string;
  fileName: string;
}

interface TextMessage {
  type: 'text';
  body: string;
}

type Base64 = string;
interface ImageMessage {
  type: 'image';
  body: Electron.NativeImage | Base64;
}

type Message = FileMessage | ImageMessage | TextMessage;

function isFileMessage(msg: unknown): msg is FileMessage {
  return isMessage(msg) && msg.type === 'file';
}
function isTextMessage(msg: unknown): msg is TextMessage {
  return isMessage(msg) && msg.type === 'text';
}
function isImageMessage(msg: unknown): msg is ImageMessage {
  return isMessage(msg) && msg.type === 'image';
}
function isMessage(msg: unknown): msg is Message {
  return typeof msg === 'object' && msg !== null && ['file', 'text', 'image'].includes((msg as Message).type);
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

export {
  isFileMessage,
  isImageMessage,
  isMessage,
  isTextMessage,
  FileMessage,
  Message,
  TextMessage,
  ImageMessage,
  isObject
};
