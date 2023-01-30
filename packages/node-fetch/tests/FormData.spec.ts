import { PonyfillBlob } from '../src/Blob';
import { PonyfillFile } from '../src/File';
import { PonyfillFormData } from '../src/FormData';
import { PonyfillRequest } from '../src/Request';
import { PonyfillResponse } from '../src/Response';

describe('Form Data', () => {
  it('Consume empty URLSearchParams as PonyfillFormData', async () => {
    const res = new PonyfillResponse(new URLSearchParams());
    const fd = await res.formData();

    expect(fd).toBeInstanceOf(PonyfillFormData);
  });

  it('Consume empty URLSearchParams as PonyfillFormData', async () => {
    const req = new PonyfillRequest('about:blank', {
      method: 'POST',
      body: new URLSearchParams(),
    });
    const fd = await req.formData();

    expect(fd).toBeInstanceOf(PonyfillFormData);
  });

  it('Consume empty PonyfillResponse.formData() as PonyfillFormData', async () => {
    const res = new PonyfillResponse(new PonyfillFormData());
    const fd = await res.formData();

    expect(fd).toBeInstanceOf(PonyfillFormData);
  });

  it('Consume empty PonyfillRequest.formData() as PonyfillFormData', async () => {
    const req = new PonyfillRequest('about:blank', {
      method: 'POST',
      body: new PonyfillFormData(),
    });
    const fd = await req.formData();

    expect(fd).toBeInstanceOf(PonyfillFormData);
  });

  it('Consume URLSearchParams with entries as PonyfillFormData', async () => {
    const res = new PonyfillResponse(new URLSearchParams({ foo: 'bar' }));
    const fd = await res.formData();

    expect(fd.get('foo')).toBe('bar');
  });

  it('should return a length for empty form-data', async () => {
    const form = new PonyfillFormData();
    const ab = await new PonyfillRequest('http://a', {
      method: 'post',
      body: form,
    }).arrayBuffer();

    expect(ab.byteLength).toBeGreaterThan(30);
  });

  it("should add a PonyfillBlob field's size to the PonyfillFormData length", async () => {
    const form = new PonyfillFormData();
    const string = 'Hello, world!';
    form.set('field', string);
    const fd = await new PonyfillRequest('about:blank', { method: 'POST', body: form }).formData();
    expect(fd.get('field')).toBe(string);
  });

  it('should return a length for a PonyfillBlob field', async () => {
    const form = new PonyfillFormData();
    const blob = new PonyfillBlob(['Hello, world!'], { type: 'text/plain' });
    form.set('PonyfillBlob', blob);

    const fd = await new PonyfillResponse(form).formData();

    expect((fd.get('PonyfillBlob') as Blob).size).toBe(13);
  });

  it('should parse fields correctly', async () => {
    const formData = new PonyfillFormData();
    formData.append('greetings', 'Hello world!');
    formData.append('bye', 'Goodbye world!');
    const request = new PonyfillRequest('http://localhost:8080', {
      method: 'POST',
      body: formData,
    });
    const formdata = await request.formData();
    expect(formdata.get('greetings')).toBe('Hello world!');
    expect(formdata.get('bye')).toBe('Goodbye world!');
  });
  it('should parse and receive text files correctly', async () => {
    const formData = new PonyfillFormData();
    const greetingsFile = new PonyfillFile(['Hello world!'], 'greetings.txt', { type: 'text/plain' });
    const byeFile = new PonyfillFile(['Goodbye world!'], 'bye.txt', { type: 'text/plain' });
    formData.append('greetings', greetingsFile);
    formData.append('bye', byeFile);
    const request = new PonyfillRequest('http://localhost:8080', {
      method: 'POST',
      body: formData,
    });
    const formdata = await request.formData();
    const receivedGreetingsFile = formdata.get('greetings') as File;
    const receivedGreetingsText = await receivedGreetingsFile.text();
    expect(receivedGreetingsText).toBe('Hello world!');
    const receivedByeFile = formdata.get('bye') as File;
    const receivedByeText = await receivedByeFile.text();
    expect(receivedByeText).toBe('Goodbye world!');
  });
  it('should handle file limits', async () => {
    const formData = new PonyfillFormData();
    const greetingsFile = new PonyfillFile(['Hello world!'], 'greetings.txt', { type: 'text/plain' });
    formData.append('greetings', greetingsFile);
    const proxyRequest = new PonyfillRequest('http://localhost:8080', {
      method: 'POST',
      body: formData,
      formDataLimits: {
        fileSize: 1,
      },
    });
    const formDataInText = await proxyRequest.text();
    const contentType = proxyRequest.headers.get('content-type')!;
    const requestWillParse = new PonyfillRequest('http://localhost:8080', {
      method: 'POST',
      body: formDataInText,
      headers: {
        'content-type': contentType,
      },
      formDataLimits: {
        fileSize: 1,
      },
    });
    await expect(() => requestWillParse.formData()).rejects.toThrowError('File size limit exceeded: 1 bytes');
  });
});
