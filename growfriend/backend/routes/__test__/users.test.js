const request = require('supertest');
const app = require('../../app');
const { createTestUser, DEFAULT_PASSWORD } = require('../../test/helpers');

describe('GET /api/users/me', () => {
  it('returns the user profile with a valid token', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@aucklanduni.ac.nz');
    expect(res.body.data.coins).toBe(30);
    expect(res.body.data.roles).toContain('USER');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me/task-stats', () => {
  it('returns zero stats for a new user', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .get('/api/users/me/task-stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ systemCompleted: 0, p2pCompleted: 0, tasksCreated: 0 });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me/task-stats');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the user name', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bobby' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Bobby');
  });

  it('updates the avatar', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: 'https://example.com/pic.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar).toBe('https://example.com/pic.jpg');
  });

  it('rejects an empty name with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a name shorter than 3 characters with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AB' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/api/users/me').send({ name: 'Bobby' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me/password', () => {
  it('changes the password with correct current password', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NewSecurePass1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects wrong current password with 401', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'NewSecurePass1' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/users/me/password')
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NewSecurePass1' });
    expect(res.status).toBe(401);
  });
});
