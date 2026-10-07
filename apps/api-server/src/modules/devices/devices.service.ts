// devices.service (devices).
import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { userDeviceDocPath, userDevicesCollectionPath } from '../../database/paths.js';

export type DevicePlatform = 'ios' | 'android' | 'web';

export type RegisterDeviceInput = {
  uid: string;
  deviceId: string;
  fcmToken: string;
  platform: DevicePlatform;
};

export type DeviceRecord = {
  uid: string;
  fcmToken: string;
  platform: DevicePlatform;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

export type DeviceWithId = DeviceRecord & {
  deviceId: string;
};

function assertDevicePlatform(platform: unknown): asserts platform is DevicePlatform {
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') {
    throw new Error('platform must be ios, android, or web');
  }
}

function mapDeviceDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): DeviceWithId {
  const data = doc.data();

  if (typeof data.uid !== 'string') {
    throw new Error('Invalid device record: uid must be a string');
  }

  if (typeof data.fcmToken !== 'string') {
    throw new Error('Invalid device record: fcmToken must be a string');
  }

  assertDevicePlatform(data.platform);

  if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
    throw new Error('Invalid device record: createdAt must be a Firestore Timestamp');
  }

  if (!data.updatedAt || typeof data.updatedAt !== 'object' || !('toDate' in data.updatedAt)) {
    throw new Error('Invalid device record: updatedAt must be a Firestore Timestamp');
  }

  return {
    deviceId: doc.id,
    uid: data.uid,
    fcmToken: data.fcmToken,
    platform: data.platform,
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
  };
}

export async function registerDevice(input: RegisterDeviceInput): Promise<void> {
  const uid = input.uid.trim();
  const deviceId = input.deviceId.trim();
  const fcmToken = input.fcmToken.trim();
  const platform = input.platform;
  const now = Timestamp.now();

  if (!uid) {
    throw new Error('uid is required');
  }

  if (!deviceId) {
    throw new Error('deviceId is required');
  }

  if (!fcmToken) {
    throw new Error('fcmToken is required');
  }

  assertDevicePlatform(platform);

  // Re-registering a device refreshes its token without resetting its original creation time.
  const deviceRef = firestore.doc(userDeviceDocPath(uid, deviceId));
  const snap = await deviceRef.get();

  if (!snap.exists) {
    await deviceRef.set({
      uid,
      fcmToken,
      platform,
      createdAt: now,
      updatedAt: now,
    } satisfies DeviceRecord);

    return;
  }

  await deviceRef.update({
    fcmToken,
    platform,
    updatedAt: now,
  });
}

export async function listDevices(uid: string): Promise<DeviceWithId[]> {
  const normalizedUid = uid.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const snap = await firestore
    .collection(userDevicesCollectionPath(normalizedUid))
    .orderBy('updatedAt', 'desc')
    .get();

  return snap.docs.map(mapDeviceDoc);
}

export async function deleteDevice(uid: string, deviceId: string): Promise<void> {
  const normalizedUid = uid.trim();
  const normalizedDeviceId = deviceId.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  if (!normalizedDeviceId) {
    throw new Error('deviceId is required');
  }

  const deviceRef = firestore.doc(userDeviceDocPath(normalizedUid, normalizedDeviceId));
  const snap = await deviceRef.get();

  if (!snap.exists) {
    throw new Error('Device not found');
  }

  await deviceRef.delete();
}
