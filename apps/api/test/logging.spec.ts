import { JsonLogger } from '../src/common/json.logger';
describe('structured log redaction', () => {
  it('emits parseable JSON without database credentials, bearer tokens, passwords or stack traces', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const logger = new JsonLogger();
      logger.log(
        'postgresql://name:topsecret@db/test Bearer token-value password=hidden JWT_SECRET=hidden-secret',
      );
      logger.error(new Error('sensitive-error-message'), 'secret-stack');
      const output = spy.mock.calls.map((call) => String(call[0]));
      output.forEach((line) => expect(() => JSON.parse(line)).not.toThrow());
      const joined = output.join(' ');
      for (const secret of [
        'topsecret',
        'token-value',
        'hidden',
        'secret-stack',
        'sensitive-error-message',
      ])
        expect(joined).not.toContain(secret);
      expect(JSON.parse(output[0]).level).toBe('info');
    } finally {
      spy.mockRestore();
    }
  });
});
