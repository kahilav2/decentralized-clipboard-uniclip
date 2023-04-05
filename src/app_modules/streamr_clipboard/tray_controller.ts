'use strict';
import { truncate } from '../../tools/index';
import { EventEmitter } from 'events';
import { Message } from './types';
import { MenuItemConstructorOptions } from 'electron';
import { StreamrConfigController } from './config_controller';
import log from 'electron-log';

interface TrayTemplateParams {
  configContr: StreamrConfigController;
  isConnected: boolean;
  lastReceivedMessages: Message[];
  clipboardContents?: Message;
  chunkedFilesNo: number;
  send: () => void;
  fetch: (arg0: Message) => void;
  reconnect: () => void;
  openConnectWindow: () => void;
}

class StreamrTrayController extends EventEmitter {
  private _showReconnect: boolean;

  constructor() {
    super();
    this._showReconnect = false;
  }

  async destroy() {
    this.removeAllListeners();
  }

  // TODO: emit actions instead of using callbacks
  getTemplate(params: TrayTemplateParams): MenuItemConstructorOptions[] {
    const template: MenuItemConstructorOptions[] = [];
    const uploadElement = this.getUploadElement(
      params.clipboardContents,
      params.configContr.isSyncModeManual(),
      params.isConnected,
      params.send
    );
    uploadElement && template.push(uploadElement);

    if (params.chunkedFilesNo > 0) {
      template.push({
        label: `Downloading ${params.chunkedFilesNo} ${params.chunkedFilesNo > 1 ? 'files' : 'file'}`,
        click: () => {}
      });
    }

    if (params.lastReceivedMessages.length > 0)
      template.push(this.getCopyElement(params.lastReceivedMessages[0], params.fetch));

    const messageHistoryElement = this.getMessageHistoryElement(params.lastReceivedMessages.slice(1), params.fetch);
    messageHistoryElement && template.push(messageHistoryElement);

    const syncModeElement = this.getSyncModeElement(params);
    syncModeElement && template.push(syncModeElement);

    template.push({ label: 'Connect to a device', click: params.openConnectWindow });

    if (this._showReconnect) {
      template.push({ label: 'Reconnect', click: params.reconnect });
    }
    return template;
  }
  getMessageHistoryElement(
    messages: Message[],
    fetch: (arg0: Message) => void
  ): MenuItemConstructorOptions | undefined {
    if (messages.length === 0) return;
    const submenu: MenuItemConstructorOptions[] = [];
    messages.forEach((msg: Message) => {
      const el = this.getCopyElement(msg, () => {
        fetch(msg);
      });
      submenu.push(el);
    });
    return {
      label: 'History',
      submenu
    };
  }
  getSyncModeElement(params: TrayTemplateParams): MenuItemConstructorOptions | undefined {
    return {
      label: 'Sync Mode',
      submenu: [
        {
          label: 'Automatic',
          type: 'radio',
          checked: params.configContr.isSyncModeAutomatic(),
          click: () => {
            params.configContr.setSyncModeToAutomatic();
          }
        },
        {
          label: 'Manual',
          type: 'radio',
          checked: params.configContr.isSyncModeManual(),
          click: () => {
            params.configContr.setSyncModeToManual();
          }
        }
      ]
    };
  }

  private getUploadElement(
    clipboardContents: any,
    isSyncModeManual: boolean,
    isConnected: boolean,
    send: any
  ): MenuItemConstructorOptions | undefined {
    if (clipboardContents && isSyncModeManual && isConnected) {
      if (clipboardContents && clipboardContents.type === 'text') {
        return { label: `Upload '${truncate(clipboardContents.body)}'`, click: send };
      }
      if (clipboardContents && clipboardContents.type === 'image') {
        return { label: 'Upload the image', click: send };
      }
      if (clipboardContents && clipboardContents.type === 'file') {
        log.debug(clipboardContents.fileName);
        return { label: `Upload ${clipboardContents.fileName}`, click: send };
      }
    }
  }

  private getCopyElement(msg: Message, fetch: any): MenuItemConstructorOptions {
    switch (msg.type) {
      case 'text':
        return {
          label: `Copy '${truncate(msg.body)}'`,
          click: () => {
            fetch(msg);
          }
        };
      case 'image':
        return {
          label: 'Copy the image',
          click: () => {
            fetch(msg);
          }
        };
      case 'file':
        return {
          label: `Open ${msg.fileName} folder`,
          click: () => {
            fetch(msg);
          }
        };
      default:
        const _exhaustiveCheck: never = msg;
        return _exhaustiveCheck;
    }
  }

  public showReconnect() {
    this._showReconnect = true;
    this.emit('refresh');
  }

  public hideReconnect() {
    this._showReconnect = false;
    this.emit('refresh');
  }

  getShowReconnect() {
    return this._showReconnect;
  }
}

export { StreamrTrayController };
