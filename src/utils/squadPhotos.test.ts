import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUAD_PLAYER_PHOTOS_BUCKET,
  isSquadPhotoStoragePath,
  normalizeSquadPhotoUrl,
  parseSquadPhotoStoragePath
} from './squadPhotos';

test('accepts valid storage path in squad bucket', () => {
  const path = `${SQUAD_PLAYER_PHOTOS_BUCKET}/p1/photo.jpg`;
  assert.equal(normalizeSquadPhotoUrl(path), path);
  assert.equal(isSquadPhotoStoragePath(path), true);
  assert.deepEqual(parseSquadPhotoStoragePath(path), {
    bucket: SQUAD_PLAYER_PHOTOS_BUCKET,
    objectPath: 'p1/photo.jpg'
  });
});

test('rejects external urls and data urls', () => {
  assert.equal(normalizeSquadPhotoUrl('https://images.example.com/p.jpg'), undefined);
  assert.equal(normalizeSquadPhotoUrl('data:image/png;base64,AAA'), undefined);
  assert.equal(isSquadPhotoStoragePath('https://images.example.com/p.jpg'), false);
  assert.equal(isSquadPhotoStoragePath('data:image/png;base64,AAA'), false);
});

test('rejects non-squad bucket paths', () => {
  assert.equal(normalizeSquadPhotoUrl('other-bucket/p1/photo.jpg'), undefined);
  assert.equal(parseSquadPhotoStoragePath('other-bucket/p1/photo.jpg'), null);
});
