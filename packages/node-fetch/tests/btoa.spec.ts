import { PonyfillBtoa } from '../src/TextEncoderDecoder';

it('should work as expected', () => {
  expect(PonyfillBtoa('Hello, world!')).toBe('SGVsbG8sIHdvcmxkIQ==');
});
