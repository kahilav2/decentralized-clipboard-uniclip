import { StreamrConnectionController } from './connection_controller';
import { ClipboardController } from './clipboard_controller';
import { StreamrMessageController } from './message_controller';
import { StreamrTrayController } from './tray_controller';
import { StreamrConfigController } from './config_controller';
import { TimeoutError } from 'bluebird';
import { BrowserWindow, dialog, ipcMain, MenuItemConstructorOptions } from 'electron';
import { InvalidPrivateKeyError } from '../../tools/errors';
import path from 'path';
import { AppModule, AppModuleConfig } from '../../types';
import fs from 'fs';
import { generateUniqueId, checkFileExists } from '../../tools';
import { shell, app, Notification, systemPreferences } from 'electron';
import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { isMessage, isObject } from './types';
import { StreamrChunker } from 'streamr-chunker';
import log from 'electron-log';

class StreamrClipboard extends EventEmitter implements AppModule {
  public static appModuleName = 'streamrClipboard';
  private clipboard?: ClipboardController;
  private configContr?: StreamrConfigController;
  private configured: boolean;
  private connectionContr?: StreamrConnectionController;
  private messageContr?: StreamrMessageController;
  private streamrChunker?: StreamrChunker;
  private trayContr?: StreamrTrayController;

  // TODO: have each appModule have their own workspace where they can save data
  constructor() {
    super();
    this.configured = false;

    powerMonitor.on('suspend', async () => {
      log.debug('System is about to enter sleep mode');
      if (this.connectionContr) await this.connectionContr.disconnect();
    });
    powerMonitor.on('resume', async () => {
      log.debug('System has resumed from sleep mode');
      if (!this.configContr) {
        log.error('configContr is not initialized');
        return;
      }
      const config = this.configContr.getConfig();
      await this.configure(config);
      await this.start();
    });
  }

  private async createDirectoryIfNotExist(dir: string) {
    log.debug('try create path', dir);
    const exists = await checkFileExists(dir);
    if (!exists) {
      await new Promise<void>((resolve, reject) => {
        fs.mkdir(dir, (err: any) => {
          if (err) {
            reject(err);
          }
          resolve();
        });
      });
    }
  }
  async configure(config: any) {
    this.configured = false;

    if (this.configContr) {
      await this.configContr.destroy();
      delete this.configContr;
    }

    this.configContr = new StreamrConfigController(config);
    this.configContr.on('change', () => {
      this.emit('refresh');
      this.emit('config-change', this.getModuleConfig());
    });

    // create uniclip directory locally
    try {
      await this.createDirectoryIfNotExist(path.join(app.getPath('documents'), 'uniclip'));
      await this.createDirectoryIfNotExist(path.join(app.getPath('userData'), 'temp_images'));
    } catch (err) {
      log.error(err);
    }

    if (this.clipboard) {
      await this.clipboard.destroy();
      delete this.clipboard;
    }
    this.clipboard = new ClipboardController();
    this.clipboard.on('any', this.textOrImageChangedHandler.bind(this));

    if (this.connectionContr) {
      await this.connectionContr.destroy();
      delete this.connectionContr;
    }
    this.connectionContr = new StreamrConnectionController(this.configContr.getConfig('connector'));
    this.connectionContr.on('connect', () => {});

    if (this.messageContr) {
      await this.messageContr.destroy();
      delete this.messageContr;
    }

    this.messageContr = await new StreamrMessageController(this.configContr.getConfig('messageController'));
    this.messageContr.on('file-created', async (msg: any) => {
      const notif = new Notification({
        title: 'File received',
        body: msg.fileName
      });
      notif.on('click', async () => {
        log.debug('opening file', msg.fullPath);
        await shell.openPath(path.join(app.getPath('documents'), 'uniclip'));
      });
      notif.show();
    });
    this.messageContr.on('message', async (msg: any) => {
      try {
        if (this.configContr && this.clipboard && this.configContr.isSyncModeAutomatic()) {
          await this.clipboard.write(msg, { deactivateHandler: true });
        }
        this.emit('refresh');
      } catch (err) {
        log.error(err);
      }
    });

    if (this.streamrChunker) {
      await this.streamrChunker.destroy();
      delete this.streamrChunker;
    }
    this.streamrChunker = new StreamrChunker()
      .withDeviceId(this.configContr.getDeviceId())
      .withIgnoreOwnMessages()
      .withMaxMessageSize(260000);
    this.streamrChunker.on('publish', async (msg: unknown) => {
      try {
        if (!isObject(msg)) {
          throw new Error('msg is not an object');
        }

        this.connectionContr && (await this.connectionContr.publish(msg));
      } catch (err) {
        log.error(err, msg);
      }
    });
    this.streamrChunker.on('message', (msg: unknown) => {
      try {
        this.messageContr && this.messageContr.receive(msg);
      } catch (err) {
        log.error(err);
      }
    });
    this.streamrChunker.on('chunk-update', (msg: unknown) => {
      this.emit('refresh');
    });
    this.connectionContr.on('message', (msg: unknown) => {
      try {
        this.streamrChunker && this.streamrChunker.receiveHandler(msg);
      } catch (err) {
        log.error(err, msg);
      }
    });
    this.messageContr.on('publish', async (msg: unknown) => {
      try {
        if (!isObject(msg)) {
          throw new Error('msg is not an object');
        }
        this.streamrChunker && (await this.streamrChunker.publish(msg));
      } catch (err) {
        log.error(err, msg);
      }
    });

    if (this.trayContr) {
      await this.trayContr.destroy();
      delete this.trayContr;
    }
    this.trayContr = new StreamrTrayController();
    this.trayContr.on('refresh', () => {
      this.emit('refresh');
    });

    log.debug('configure finish');
    this.configured = true;
  }
  async openHelpWindow(): Promise<void> {
    const window = new BrowserWindow({
      width: 720,
      height: 650,
      icon: path.join(__dirname, '..', '..', '..', 'assets', 'icon_color.png'),
      webPreferences: {
        nodeIntegration: true,
      }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });
    //window.setMenu(null);
    await window.loadFile(path.join(__dirname, 'html', 'help', 'help.html'));
    await window.show();
    return new Promise<void>((resolve) => {
      window.on('closed', () => {
        resolve();
      });
    });
  }

  async runSetup(): Promise<boolean> {
    if (process.platform === 'darwin') {
      systemPreferences.askForMediaAccess('camera');
    }

    const window = new BrowserWindow({
      width: 720,
      height: 650,
      icon: path.join(__dirname, '..', '..', '..', 'assets', 'icon_color.png'),
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, 'html', 'setup', 'preload.js')
      }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });
    //window.setMenu(null);
    await window.loadFile(path.join(__dirname, 'html', 'setup', 'setup.html'));
    await window.webContents.send('settings', {
      appModuleConfig: this.configContr?.getConfig(),
      openAtLogin: app.getLoginItemSettings().openAtLogin,
      platform: process.platform
    });
    await window.show();

    let interrupted = true;
    // block runtime until the user has finished with the setup flow
    return new Promise<boolean>((resolve, reject) => {
      window.on('close', () => {
        resolve(interrupted);
      });
      const finishedListener = async (_: any, formData: string) => {
        try {
          log.debug('finishedListener');
          interrupted = false;
          const formJson = JSON.parse(formData);
          let newConfig;
          if (!this.configContr) {
            // first time
            newConfig = {
              deviceId: generateUniqueId(),
              syncMode: 'automatic',
              privateKey: formJson.privateKey,
              streamUrl: formJson.streamUrl
            };

            await this.configure(newConfig);
            this.emit('config-change', this.getModuleConfig());
            void this.openConnectWindow().then(() => {
              this.openHelpWindow().then(() => {
                new Notification({
                  title: 'Uniclip',
                  body: 'Setup finished. You can find the app in the task bar.'
                }).show();
              });
            });
          } else {
            // re-configuration
            newConfig = JSON.parse(JSON.stringify(this.configContr.getConfig()));
            newConfig.privateKey = formJson.privateKey;
            newConfig.streamUrl = formJson.streamUrl;

            await this.configure(newConfig);
            this.emit('config-change', this.getModuleConfig());
          }
          window.close();
        } catch (err) {
          log.error(err);
          reject(err);
        } finally {
          log.debug('removing finished listener (streamr-clipboard setup)');
          ipcMain.off('finished', finishedListener);
        }
      };
      ipcMain.on('finished', finishedListener);
      ipcMain.on('setOpenAtLogin', (_: any, openAtLogin: any) => {
        log.debug('setOpenAtLogin', openAtLogin);
        app.setLoginItemSettings({ openAtLogin });
      });
    });
  }

  getModuleConfig(): AppModuleConfig {
    if (!this.configContr) {
      throw new Error('configController undefined');
    }
    const config = this.configContr.getConfig();
    const moduleConfig = {
      name: StreamrClipboard.appModuleName,
      config
    };
    return moduleConfig;
  }

  async textOrImageChangedHandler(msg: unknown) {
    if (!this.configured || !isMessage(msg)) return; //TODO: remove this variable?
    if (this.configContr && this.configContr.isSyncModeAutomatic()) {
      try {
        if (this.messageContr) {
          await this.messageContr.upload(msg);
        }
      } catch (err) {
        log.error(err);
      }
    }
    this.emit('refresh');
  }

  public async start(): Promise<void> {
    this.emit('refresh');
    try {
      await this.reconnect();
    } catch (err: any) {
      log.error(err);
      if (err.code === 'INVALID_PRIVATE_KEY_ERROR') {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Failure',
          message: 'Private key is invalid',
          buttons: ['OK']
        });
      } else if (err.code === 'MISSING_PERMISSION') {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Failure',
          message: 'The private key provided lacks the permission to listen to the stream',
          buttons: ['OK']
        });
      }

      const interrupted = await this.runSetup();
      if (interrupted) {
        this.emit('quit');
      }
      void this.start();
    }
  }

  getTrayTemplate(): MenuItemConstructorOptions[] | undefined {
    if (
      !this.clipboard ||
      !this.trayContr ||
      !this.connectionContr ||
      !this.messageContr ||
      !this.configContr ||
      !this.streamrChunker
    )
      return;
    const chunks = this.streamrChunker?.getChunks();
    const chunkedFilesNo = Object.keys(chunks).length;

    return this.trayContr.getTemplate({
      configContr: this.configContr,
      isConnected: this.connectionContr.getIsConnected(),
      lastReceivedMessages: this.messageContr.getLatestMessages().reverse(),
      clipboardContents: this.clipboard.getLatestContents(),
      chunkedFilesNo,
      send: () => {
        void this.sendHandler();
      },
      fetch: (msg: any) => {
        void this.fetchHandler(msg);
      },
      reconnect: () => {
        void this.reconnectHandler();
      },
      openConnectWindow: () => {
        void this.openConnectWindow();
      }
    });
  }

  private async openConnectWindow() {
    const window = new BrowserWindow({
      width: 720,
      height: 540,
      icon: path.join(__dirname, '..', '..', '..', 'assets', 'icon_color.png'),
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, 'html', 'connect', 'preload.js')
      }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });
    //window.setMenu(null);
    await window.loadFile(path.join(__dirname, 'html', 'connect', 'connect.html'));
    await window.webContents.send('config', this.configContr?.getConfig());
    await window.show();
    return new Promise<void>((resolve, reject) => {
      window.on('close', () => {
        resolve();
      });
    });
  }

  async reconnectHandler() {
    if (!this.trayContr) return;

    this.trayContr.hideReconnect();
    await this.reconnect();
  }

  async reconnect() {
    try {
      if (this.connectionContr) {
        await this.connectionContr.connect();
      } else throw new Error('connectionContr was undefined');
    } catch (err) {
      log.error('reconnect() received', err);
      if (err instanceof TimeoutError) {
        const notification = {
          title: 'Problem',
          body: 'Conneting attempt timed out'
        };
        this.emit('notification', notification);
        this.trayContr && this.trayContr.showReconnect();
      }
      if (err instanceof InvalidPrivateKeyError) {
        throw err;
      }
    }
  }
  async sendHandler() {
    if (!this.clipboard || !this.messageContr) return;
    const msg = this.clipboard.getLatestContents();
    if (!msg) return;
    if (msg.type === 'file') {
      log.debug('Sending', msg.fileName);
    } else if (msg.type === 'text') {
      log.debug('Sending', msg.body.substring(0, 100));
    } else if (msg.type === 'image') {
      log.debug('Sending an image');
    }

    try {
      await this.messageContr.upload(msg);
    } catch (err: any) {
      log.error('sendHandler', err);
    }
  }
  async fetchHandler(msg: any) {
    if (!this.clipboard) return;

    if (!isMessage(msg)) {
      log.debug('fetchHandler go a non-Message');
      return;
    }
    if (msg.type === 'file') {
      try {
        await shell.openPath(path.join(app.getPath('documents'), 'uniclip'));
      } catch (err) {
        log.error(err);
      }
      return;
    }

    log.debug('Overriding clipboard with', msg.type === 'image' ? 'an image' : msg.body);
    await this.clipboard.write(msg);
  }

  async destroy() {
    this.removeAllListeners();
    if (this.messageContr) this.messageContr.destroy();
    if (this.configContr) this.configContr.destroy();
    if (this.clipboard) this.clipboard.destroy();
    if (this.connectionContr) await this.connectionContr.destroy();
  }
}

export { StreamrClipboard };
