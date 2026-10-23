/**
 * Thrown when a body is read and the byte count does not match a declared
 * `Content-Length` header. Excess bytes fail as soon as they are observed so
 * callers never receive more data than the header promised.
 */
export class ContentLengthMismatchError extends Error {
  name = 'ContentLengthMismatchError';
  code = 'CONTENT_LENGTH_MISMATCH';

  constructor(message = 'Body length does not match content-length header') {
    super(message);
  }
}
