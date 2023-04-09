import { sleep, generateUniqueId } from '../../tools';
import { NotReadyError, InvalidPrivateKeyError } from '../../tools/errors';
import AwaitLock from 'await-lock';
import { StreamrClient, STREAMR_STORAGE_NODE_GERMANY } from 'streamr-client';
import { EventEmitter } from 'events';
import { Config } from './config_controller';
import log from 'electron-log';

class TimeoutTracker {
  private timeoutPassed: boolean;

  constructor(timeout: number) {
    this.timeoutPassed = false;

    setTimeout(() => {
      this.timeoutPassed = true;
    }, timeout);
  }
  public timedOut(): boolean {
    return this.timeoutPassed;
  }
}

class StreamrConnectionController extends EventEmitter {
  private subscription: any;
  private id: string;
  private lock: AwaitLock;
  private streamUrl: string;
  private privateKey: string;
  private isConnected: boolean;
  private haltConnecting: boolean;
  private streamrCli?: StreamrClient;

  constructor(config: Partial<Config>) {
    super();
    this.id = 'conn_' + generateUniqueId().substring(0, 5);
    this.lock = new AwaitLock();
    if (config.streamUrl && config.privateKey) {
      this.streamUrl = config.streamUrl;
      this.privateKey = config.privateKey;
    } else {
      throw new Error('StreamrConnectionController improperly initialized');
    }
    this.isConnected = false;
    this.haltConnecting = false;
  }

  public async publish(message: object) {
    if (!this.isConnected) {
      throw new NotReadyError('publish called while not connected');
    }
    if (!this.streamrCli) {
      throw new NotReadyError('streamrCli is destroyed');
    }
    // FOR THOSE DEBUGGING: here we just call streamrCli
    log.debug("streamUrl", this.streamUrl)
    const msgStr = JSON.stringify(message)
    log.debug("length:", msgStr.length, "contents:", msgStr.substring(0,30) + "..." + msgStr.substring(msgStr.length-30))
    await this.streamrCli.publish(this.streamUrl, message);
  }

  async connect({ timeout }: { timeout: number } = { timeout: 5000 }) {
    const timeoutTracker = new TimeoutTracker(timeout);
    log.debug(this.id, 'Proceeding to take the connection lock');
    await this.lock.acquireAsync();
    log.debug(this.id, 'lock acquired');
    try {
      await this._connect(timeoutTracker);
    } finally {
      log.debug(this.id, 'lock was released by connect');
      this.lock.release();
    }
  }
  async _connect(timeoutTracker: TimeoutTracker) {
    if (this.isConnected) return log.debug(this.id, 'already connected');
    this.haltConnecting = false;

    while (!this.isConnected && !this.haltConnecting && !timeoutTracker.timedOut()) {
      log.debug(this.id, 'Connecting...', this.privateKey, this.streamUrl);
      try {
        // FOR THOSE DEBUGGING: Initialize with webrtcMaxMessageSize
        this.streamrCli = new StreamrClient({
          auth: {
            privateKey: this.privateKey
          },
          network: {
            webrtcMaxMessageSize: 1048576
          }
          // encryption: {
          //   litProtocolEnabled: true,
          // }
        });

        const isStoredStream = await this.streamrCli.isStoredStream(this.streamUrl, STREAMR_STORAGE_NODE_GERMANY);
        log.debug('isStoredStream', isStoredStream);
        this.subscription = await this.streamrCli.subscribe(
          {
            id: this.streamUrl,
            ...(isStoredStream ? { resend: { last: 10 } } : {})
          },
          (msg: any) => {
            log.debug('conn inside message received', JSON.stringify(msg).substring(0, 100));
            this.emit('message', msg);
          }
        );
        this.isConnected = true;
        this.emit('connect');
        log.debug(this.id, 'Connection established', this.isConnected);
      } catch (err: any) {
        log.error(this.id, 'caught', err);
        if (err.code === 'CLIENT_DESTROYED') {
          log.debug(this.id, 'client destroyed while trying to connect');
          throw err;
        }
        if (err.message === `/auth/privateKey must match format "ethereum-private-key"`) {
          throw new InvalidPrivateKeyError('invalid private key provided');
        }
        for (let i = 0; i < 3; i++) {
          await sleep(1000);
          if (timeoutTracker.timedOut()) {
            log.debug(this.id, 'timeout passed');
            throw new Error('Timeout');
          }
          if (this.haltConnecting) {
            log.debug(this.id, 'halted connecting');
            return;
          }
        }
      }
    }
  }
  public getIsConnected(): boolean {
    return this.isConnected;
  }
  async disconnect() {
    this.haltConnecting = true;
    await this.lock.acquireAsync();
    log.debug(this.id, 'lock acquired by disconnect');
    try {
      if (this.subscription) {
        log.debug(this.id, 'unsubscribing...');
        await this.subscription.unsubscribe();
      }
      if (!this.streamrCli) return;
      await this.streamrCli.destroy();
      this.isConnected = false;
      log.debug(this.id, 'disconnected');
    } catch (err) {
      log.error(this.id, 'ERR disconnect', err);
    } finally {
      this.lock.release();
      log.debug(this.id, 'lock released by disconnect');
    }
  }
  async destroy() {
    this.removeAllListeners();
    await this.disconnect();
  }
}

export { StreamrConnectionController };
