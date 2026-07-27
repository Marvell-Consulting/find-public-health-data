export class InvalidJwtSessionError extends Error {
  constructor() {
    super('Invalid JWT session');
    this.name = 'InvalidJwtSessionError';
  }
}
