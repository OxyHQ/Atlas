import { expect, test } from 'bun:test';
import { OxyServices } from '@oxy.so/core';

function token(claims: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture`;
}

test('published Core resolves supported token subjects and same-session rotation', () => {
  const oxy = new OxyServices({ baseURL: 'https://api.test' });
  try {
    oxy.session.setAccessToken(token({ userId: 'alice', sessionId: 'session-a' }));
    expect(oxy.session.userId).toBe('alice');
    const epoch = oxy.http.getSessionEpoch();
    oxy.session.setAccessToken(token({ userId: 'alice', sessionId: 'session-a', exp: 2000000000 }));
    expect(oxy.session.userId).toBe('alice');
    expect(oxy.http.getSessionEpoch()).toBe(epoch);
    oxy.session.setAccessToken(token({ id: 'bob', sessionId: 'session-b' }));
    expect(oxy.session.userId).toBe('bob');
    oxy.session.setAccessToken(token({ sub: 'charlie', sessionId: 'session-c' }));
    expect(oxy.session.userId).toBeNull();
    oxy.session.setAccessToken('opaque-token');
    expect(oxy.session.userId).toBeNull();
  } finally {
    oxy.dispose();
  }
});
