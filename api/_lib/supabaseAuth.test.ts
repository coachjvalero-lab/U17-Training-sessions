import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, verifySupabaseUser } from './supabaseAuth';

test('extractBearerToken returns null when there is no Authorization header', () => {
  assert.equal(extractBearerToken(undefined), null);
});

test('extractBearerToken returns null for a non-Bearer header', () => {
  assert.equal(extractBearerToken('Basic abc123'), null);
});

test('extractBearerToken returns null for an empty Bearer token', () => {
  assert.equal(extractBearerToken('Bearer '), null);
});

test('extractBearerToken extracts the token from a valid header', () => {
  assert.equal(extractBearerToken('Bearer my-token'), 'my-token');
});

test('G. endpoint without a session is rejected', async () => {
  const deps = { getUser: async () => ({ data: null, error: new Error('invalid token') }) };
  const authorized = await verifySupabaseUser(undefined, deps);
  assert.equal(authorized, false);
});

test('G. endpoint with an invalid/expired token is rejected', async () => {
  const deps = { getUser: async () => ({ data: null, error: new Error('invalid token') }) };
  const authorized = await verifySupabaseUser('Bearer expired-token', deps);
  assert.equal(authorized, false);
});

test('H. endpoint with a valid session can continue', async () => {
  const deps = { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) };
  const authorized = await verifySupabaseUser('Bearer valid-token', deps);
  assert.equal(authorized, true);
});

test('verifySupabaseUser does not throw when the lookup itself throws', async () => {
  const deps = { getUser: async () => { throw new Error('network error'); } };
  const authorized = await verifySupabaseUser('Bearer some-token', deps);
  assert.equal(authorized, false);
});
