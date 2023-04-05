import { Tray, Menu, ipcMain, dialog, Notification } from 'electron';
import { BrowserWindow } from 'electron';

import * as path from 'path';
import { StreamrClipboard } from './app_modules/streamr_clipboard/app_module';
import * as fs from 'fs';
import { AppModuleConfig, AppModule } from './types';
import log from 'electron-log';

import Promise2 from 'bluebird';

interface TrayIconPath {
  [key: string]: string;
}

export default class Main {
  private static isDevelopment = process.env.NODE_ENV === 'development';
  private static appModules: AppModule[] = [];
  private static tray: Tray;
  private static app: Electron.App;
  private static BrowserWindow: any;
  private static trayIconPathFromPlatform: TrayIconPath = {
    darwin: 'icon.png',
    linux: 'icon_linux.png',
    win32: 'icon.ico'
  };
  private static baseTrayTemplate: Electron.MenuItemConstructorOptions[] = [
    { type: 'separator' },
    { label: 'Quit', click: () => Main.app.quit() },
    ...(this.isDevelopment ? [{ label: 'Development ver.', enabled: false }] : [])
  ];
  private static async onReady() {
    if (process.platform === 'darwin') {
      Main.app.dock.hide();
    }
    try {
      let appConfig = Main.readConfigFileFromDisk();
      Main.appModules = [];
      if (!appConfig) {
        // onboard user
        const defaultModules = [new StreamrClipboard()];
        Main.appModules = defaultModules;

        const { interrupted } = await Main.runIntroduction();
        if (interrupted) {
          Main.app.quit();
          return;
        }
        for (let i = 0; i < Main.appModules.length; i++) {
          const interrupted = await Main.appModules[i].runSetup();
          if (interrupted) {
            Main.app.quit();
            return;
          }
        }
        log.debug('modules have been configured');

        appConfig = {
          appModules: []
        };
        Main.appModules.forEach((mod) => appConfig.appModules.push(mod.getModuleConfig()));
        log.debug('saving newAppConfig', appConfig);
        Main.saveAppConfig(appConfig);
      } else {
        Main.appModules = await Main.getAppModules(appConfig);
      }
      log.debug('setup finished');
      if (Main.appModules.length === 0) {
        throw Error('No appmodules to loaded');
      }
      await Main.start();
    } catch (err) {
      log.error(err);
      Main.app.quit();
      return;
    }
  }
  private static async onBeforeQuit() {
    log.debug('before-quit');
    await Main.cleanUp();
  }
  private static async cleanUp() {
    log.debug('CleanUp');
    const p = new Promise2(async (resolve, reject) => {
      try {
        if (Main.appModules) {
          for (let i = 0; i < Main.appModules.length; i++) {
            await Main.appModules[i].destroy();
          }
        }
        if (Main.tray) {
          Main.tray.destroy();
        }
      } catch (err) {
        reject(err);
      }
      resolve();
    }).timeout(5000);
    try {
      await p;
    } catch (err) {
      log.error('Waiting for program to exit failed', err);
    }
  }
  public static main(application: Electron.App, browserWindow: typeof BrowserWindow) {
    const buildTimestamp = fs.readFileSync(path.join(__dirname, 'build_timestamp'), 'utf8');
    log.initialize({ preload: true });
    log.debug(application.getPath('logs'));
    log.info(`
    ###################
    ## App launch
    ## ${Main.isDevelopment ? '[ Development version ]' : '[ Production version ]'}
    ## Build time: ${buildTimestamp}
    ## Time: ${new Date()}
    ###################`);
    Main.BrowserWindow = browserWindow;
    Main.app = application;
    Main.app.on('ready', Main.onReady);
    Main.app.on('before-quit', Main.onBeforeQuit);
    Main.app.on('window-all-closed', Main.onWindowAllClosed);
    process.on('uncaughtException', Main.onUncaughtException);
  }
  private static async onUncaughtException(err: any) {
    // on windows some dependency raises an uncaught EBADF exception
    if (process.platform === 'win32' && err.code === 'EBADF') {
      log.debug('Prevented EBADF error from closing the app');
      return;
    }
    log.error(err, err.code);
    Main.app.quit();
  }

  private static saveAppConfig(appConfig: object) {
    const jsonString = JSON.stringify(appConfig);
    fs.writeFile(Main.getConfigPath(), jsonString, (err) => {
      if (err) {
        log.error('Error writing file', err);
        dialog.showErrorBox('Error writing file', 'Error writing file');
      }
    });
  }

  private static async getAppModules(appConfig: any) {
    const modules: StreamrClipboard[] = [];
    for (let i = 0; i < appConfig.appModules.length; i++) {
      const module = appConfig.appModules[i];
      if (module.name === 'streamrClipboard') {
        const path = Main.app.getPath('userData');
        const mod = new StreamrClipboard();
        await mod.configure(module.config);
        modules.push(mod);
      }
    }
    return modules;
  }
  private static onWindowAllClosed() {
    log.debug('window-all-closed');
  }

  private static readConfigFileFromDisk(): any {
    const configPath = Main.getConfigPath();
    log.debug(configPath, fs.existsSync(configPath));
    if (fs.existsSync(configPath)) {
      try {
        const configFile = fs.readFileSync(configPath);
        const appConfig = JSON.parse(configFile.toString());
        log.debug(appConfig);
        return appConfig;
      } catch (err) {
        log.error('can not read config file', err);
      }
    }
  }

  private static getConfigPath(): string {
    return path.join(Main.app.getPath('userData'), 'config.json');
  }

  private static async runIntroduction(): Promise<{ interrupted: boolean }> {
    log.debug('runIntroduction');

    const window = new BrowserWindow({
      width: 720,
      height: 580,
      icon: path.join(__dirname, '..', 'assets', 'icon_color.png'),
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, 'html', 'introduction', 'preload.js')
      }
    });

    window.setMenu(null);
    await window.loadFile(path.join(__dirname, 'html', 'introduction', 'introduction.html'));

    let interrupted = true;

    // block runtime until user has finished with the setup flow
    return new Promise((resolve, reject) => {
      window.on('close', () => {
        resolve({ interrupted });
      });

      const finishedListener = () => {
        interrupted = false;
        ipcMain.off('finished', finishedListener);
        window.close();
      };
      ipcMain.on('finished', finishedListener);
    });
  }

  private static async start(): Promise<void> {
    Main.tray = new Tray(path.join(__dirname, '..', 'assets', Main.trayIconPathFromPlatform[process.platform]));

    Main.tray.setToolTip('Uniclip');

    if (process.platform === 'win32') {
      // needed for notifications to work on win32
      Main.app.setAppUserModelId('com.kahilav2.uniclip');

      // on win32 the tray menu is only opened with a right click,
      // the following allows for opening it with left click too
      Main.tray.on('click', (event, bounds) => {
        Main.tray.popUpContextMenu();
      });
    }
    log.debug('setting up appModules listeners', Main.appModules.length);
    for (let i = 0; i < Main.appModules.length; i++) {
      const idx = i;
      Main.appModules[idx].on('config-change', () => {
        log.debug('moduleConfig has changed');
        const appModules: AppModuleConfig[] = [];
        Main.appModules.forEach((module) => appModules.push(module.getModuleConfig()));
        const newAppConfig = {
          appModules
        };
        Main.saveAppConfig(newAppConfig);
      });
      Main.appModules[idx].on('notification', (notif: Notification) => {
        log.debug('notification', notif);
        // add functionality for muting specific app modules here
        new Notification(notif).show();
      });
      Main.appModules[idx].on('quit', () => {
        Main.app.quit();
      });
      Main.appModules[idx].on('refresh', () => {
        const moduleTemplate = Main.appModules[idx].getTrayTemplate();
        if (!moduleTemplate) return;
        const configTemplate: Electron.MenuItemConstructorOptions[] = [
          {
            label: 'Settings',
            click: async () => {
              const interrupted = await Main.appModules[idx].runSetup();
              if (interrupted) return;
              await Main.appModules[idx].start();
            }
          }
        ];

        const mergedTemplate = [...moduleTemplate, ...configTemplate, ...Main.baseTrayTemplate];

        const template = Menu.buildFromTemplate(mergedTemplate);

        Main.tray.setContextMenu(template);
      });
    }

    log.debug('starting appModules');
    for (let i = 0; i < Main.appModules.length; i++) {
      try {
        await Main.appModules[i].start();
      } catch (err) {
        log.error(err);
        Main.app.quit();
      }
    }

  }
}
