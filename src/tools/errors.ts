class NotReadyError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'NotReadyError';
    this.code = 'NOT_READY_ERROR';
  }
}

class InvalidPrivateKeyError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidPrivateKeyError';
    this.code = 'INVALID_PRIVATE_KEY_ERROR';
  }
}

export { NotReadyError, InvalidPrivateKeyError };
