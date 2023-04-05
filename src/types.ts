import { MenuItemConstructorOptions } from 'electron';

interface AppModuleConfig {
  name: string;
  config: any;
}
interface AppModule {
  start(): Promise<void>;
  runSetup(): Promise<boolean>;
  getModuleConfig(): AppModuleConfig;
  getTrayTemplate(): MenuItemConstructorOptions[] | undefined;
  destroy(): Promise<void>;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}
export { AppModuleConfig, AppModule };
