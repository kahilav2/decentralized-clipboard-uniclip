import { promises as fs } from 'fs';

const TRUNCATE_DEFAULT_LENGTH = 30;

interface TruncateOptions {
  length?: number;
}

const truncate = (input: string, { length = TRUNCATE_DEFAULT_LENGTH }: TruncateOptions = {}): string => {
  return input.length > length ? `${input.substring(0, length)}...` : input;
};

const generateUniqueId = (): string => {
  return Math.random().toString(36).substr(2, 8) + Math.random().toString(36).substr(2, 8);
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkFileExists(file: string): Promise<boolean> {
  return fs
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export { sleep, truncate, generateUniqueId, checkFileExists };
