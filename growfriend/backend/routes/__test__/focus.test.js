const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { createTestUser } = require('../../test/helpers');
const FocusSession = require('../../models/FocusSession');

describe('POST /api/focus/start', () => {
  it('starts a new focus session with the given duration', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedDurationSec: 1500 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RUNNING');
    expect(res.body.data.plannedDurationSec).toBe(1500);
  });

  it('defaults plannedDurationSec to 25 minutes when not provided', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.plannedDurationSec).toBe(1500);
  });

  it('returns 409 when a session is already running', async () => {
    const { user, token } = await createTestUser();
    await FocusSession.create({ userId: user._id, status: 'RUNNING' });

    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/focus/start').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/focus/active', () => {
  it('returns null when no session is running', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/focus/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns the active running session', async () => {
    const { user, token } = await createTestUser();
    await FocusSession.create({ userId: user._id, status: 'RUNNING', plannedDurationSec: 3000 });

    const res = await request(app).get('/api/focus/active').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RUNNING');
    expect(res.body.data.plannedDurationSec).toBe(3000);
  });

  it('does not return a completed or cancelled session', async () => {
    const { user, token } = await createTestUser();
    await FocusSession.create({ userId: user._id, status: 'COMPLETED' });

    const res = await request(app).get('/api/focus/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/focus/active');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/focus/:id/complete', () => {
  it('completes the session and awards 10 coins', async () => {
    const { user, token } = await createTestUser();
    const session = await FocusSession.create({
      userId: user._id,
      status: 'RUNNING',
      plannedDurationSec: 1500
    });

    const res = await request(app)
      .post(`/api/focus/${session._id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.session.status).toBe('COMPLETED');
    expect(res.body.data.coins).toBe(40); // 30 initial + 10 reward
  });

  it('returns the already-completed session without re-awarding coins', async () => {
    const { user, token } = await createTestUser();
    const now = new Date();
    const session = await FocusSession.create({
      userId: user._id,
      status: 'COMPLETED',
      rewardedAt: now,
      rewardCoins: 10
    });

    const res = await request(app)
      .post(`/api/focus/${session._id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.session.status).toBe('COMPLETED');
  });

  it('returns 400 when the session is already cancelled', async () => {
    const { user, token } = await createTestUser();
    const session = await FocusSession.create({ userId: user._id, status: 'CANCELLED' });

    const res = await request(app)
      .post(`/api/focus/${session._id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 when the session does not exist', async () => {
    const { token } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/focus/${fakeId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/focus/${fakeId}/complete`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/focus/:id/cancel', () => {
  it('cancels a running session', async () => {
    const { user, token } = await createTestUser();
    const session = await FocusSession.create({ userId: user._id, status: 'RUNNING' });

    const res = await request(app)
      .post(`/api/focus/${session._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.endedAt).not.toBeNull();
  });

  it('returns 404 when the session does not exist', async () => {
    const { token } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/focus/${fakeId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/focus/${fakeId}/cancel`);
    expect(res.status).toBe(401);
  });
});
