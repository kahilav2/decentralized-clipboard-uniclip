import EventEmitter from 'events';

type Config = {
  privateKey: string;
  streamUrl: string;
  deviceId: string;
  syncMode: string;
  [key: string]: any;
};

const necessaryProperties: { [key: string]: string[] } = {
  connector: ['privateKey', 'streamUrl'],
  messageController: ['deviceId']
};

class StreamrConfigController extends EventEmitter {
  privateKey: string;
  streamUrl: string;
  deviceId: string;
  syncMode: string;

  constructor(config: Config) {
    super();
    this.privateKey = config.privateKey;
    this.streamUrl = config.streamUrl;
    this.deviceId = config.deviceId;
    this.syncMode = config.syncMode;
  }

  public destroy(): void {
    this.removeAllListeners();
  }

  public setSyncModeToAutomatic(): void {
    this.syncMode = 'automatic';
    this.emit('change', { name: 'syncMode', value: this.syncMode });
  }

  public setSyncModeToManual(): void {
    this.syncMode = 'manual';
    this.emit('change', { name: 'syncMode', value: this.syncMode });
  }

  public isSyncModeManual(): boolean {
    return this.syncMode === 'manual';
  }

  public isSyncModeAutomatic(): boolean {
    return this.syncMode === 'automatic';
  }
  public getDeviceId(): string {
    return this.deviceId;
  }

  getConfig(configSetId?: string): Config | Partial<Config> {
    const baseConfig: Config = {
      privateKey: this.privateKey,
      streamUrl: this.streamUrl,
      syncMode: this.syncMode,
      deviceId: this.deviceId
    };
    if (!configSetId) {
      return baseConfig;
    }

    const extractedProps = necessaryProperties[configSetId].reduce((obj: { [key: string]: string }, prop: string) => {
      obj[prop] = baseConfig[prop];
      return obj;
    }, {});

    return extractedProps;
  }
}

export { StreamrConfigController, Config };
