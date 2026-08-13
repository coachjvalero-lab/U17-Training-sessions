import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSurfaceSessionSubscriptionError } from './cloudStatusPolicy';

test('does not surface a subscription error when cached sessions exist', () => {
  assert.equal(
    shouldSurfaceSessionSubscriptionError({ hasCachedSessions: true, hasLoadedRemoteSession: false }),
    false
  );
});

test('does not surface a subscription error after a remote session was already loaded', () => {
  assert.equal(
    shouldSurfaceSessionSubscriptionError({ hasCachedSessions: false, hasLoadedRemoteSession: true }),
    false
  );
});

test('surfaces the subscription error only when there is no fallback data at all', () => {
  assert.equal(
    shouldSurfaceSessionSubscriptionError({ hasCachedSessions: false, hasLoadedRemoteSession: false }),
    true
  );
});
