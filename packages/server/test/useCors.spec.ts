import { Request, Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { CORSOptions, getCORSHeadersByRequestAndOptions, useCORS } from '../src/plugins/useCors';

describe('CORS', () => {
  describe('OPTIONS call', () => {
    it('should respond with correct status & headers', async () => {
      const adapter = createServerAdapter(() => new Response('Hello World!'), {
        plugins: [useCORS()],
      });
      const result = await adapter.fetch('http://yoga/graphql', {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result.status).toEqual(204);
      expect(result.headers.get('Content-Length')).toEqual('0');
    });
  });
  describe('No origins specified', () => {
    const corsOptionsWithNoOrigins = {};
    it('should not return any CORS header if no origin is sent with header', () => {
      const request = new Request('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithNoOrigins);
      expect(headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
    it('should return the origin if it is sent with header', () => {
      const origin = 'http://localhost:4000';
      const request = new Request('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin,
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithNoOrigins);
      expect(headers?.['Access-Control-Allow-Origin']).toBe(origin);
    });
  });
  describe('Single allowed origin', () => {
    const corsOptionsWithSingleOrigin = {
      origin: 'http://localhost:4000',
    };
    it('should return the origin even if it is different than the sent origin', () => {
      const request = new Request('http://localhost:4001/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:4001',
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithSingleOrigin);
      expect(headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:4000');
    });
  });
  describe('Multiple allowed origins', () => {
    const corsOptionsWithMultipleOrigins: CORSOptions = {
      origin: ['http://localhost:4000', 'http://localhost:4001'],
    };
    it('should return the origin itself if it matches', () => {
      const request = new Request('http://localhost:4001/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:4001',
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithMultipleOrigins);
      expect(headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:4001');
    });
    it('should return null if the sent origin does not match', () => {
      const request = new Request('http://localhost:4002/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:4002',
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithMultipleOrigins);
      expect(headers?.['Access-Control-Allow-Origin']).toBe('null');
    });
  });
  describe('Disabled CORS', () => {
    const corsOptionsWithDisabledCORS: CORSOptions = false;
    it('should return null if the origin is sent', () => {
      const request = new Request('http://localhost:4001/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:4001',
        },
      });
      const headers = getCORSHeadersByRequestAndOptions(request, corsOptionsWithDisabledCORS);
      expect(headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });
});
