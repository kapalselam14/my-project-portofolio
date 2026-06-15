const request = require('supertest');
const app = require('../../app');
const { seedSpecies } = require('../../test/helpers');

const VALID = {
  name: 'Alice',
  email: 'alice@aucklanduni.ac.nz',
  password: 'SecurePass1',
  securityQuestionCode: 'MOTHER_NAME',
  securityAnswer: 'mum'
};

describe('POST /api/auth/register', () => {
  beforeEach(() => seedSpecies());

  it('registers a new user and returns a JWT + user object', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@aucklanduni.ac.nz');
    expect(res.body.data.user.coins).toBe(30);
    expect(res.body.data.user.roles).toContain('USER');
  });

  it('creates a default pet on registration', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.body.data.defaultPet).toBeDefined();
    expect(res.body.data.defaultPet.stage).toBe('EGG');
  });

  it('rejects non-Auckland email with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, email: 'alice@gmail.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects password shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects missing required fields with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: VALID.email });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(VALID);
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await seedSpecies();
    await request(app).post('/api/auth/register').send(VALID);
  });

  it('logs in with correct credentials and returns a token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: VALID.email,
      password: VALID.password
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(VALID.email);
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: VALID.email,
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@aucklanduni.ac.nz',
      password: VALID.password
    });
    expect(res.status).toBe(401);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: VALID.email });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot/identify', () => {
  beforeEach(async () => {
    await seedSpecies();
    await request(app).post('/api/auth/register').send(VALID);
  });

  it('identifies a user by email and returns their security question', async () => {
    const res = await request(app)
      .post('/api/auth/forgot/identify')
      .send({ identifier: VALID.email });
    expect(res.status).toBe(200);
    expect(res.body.data.securityQuestionCode).toBe(VALID.securityQuestionCode);
    expect(res.body.data.userId).toBeDefined();
  });

  it('returns 404 for an unknown identifier', async () => {
    const res = await request(app)
      .post('/api/auth/forgot/identify')
      .send({ identifier: 'nobody@aucklanduni.ac.nz' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when identifier is missing', async () => {
    const res = await request(app).post('/api/auth/forgot/identify').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot/reset', () => {
  let userId;

  beforeEach(async () => {
    await seedSpecies();
    const reg = await request(app).post('/api/auth/register').send(VALID);
    userId = reg.body.data.user.id;
  });

  it('resets the password with the correct security answer', async () => {
    const res = await request(app).post('/api/auth/forgot/reset').send({
      userId,
      email: VALID.email,
      securityAnswer: VALID.securityAnswer,
      newPassword: 'NewSecurePass1'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID.email,
      password: 'NewSecurePass1'
    });
    expect(loginRes.status).toBe(200);
  });

  it('rejects a wrong security answer with 401', async () => {
    const res = await request(app).post('/api/auth/forgot/reset').send({
      userId,
      email: VALID.email,
      securityAnswer: 'wronganswer',
      newPassword: 'NewSecurePass1'
    });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/api/auth/forgot/reset').send({
      userId,
      email: VALID.email,
      securityAnswer: VALID.securityAnswer,
      newPassword: 'abc'
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/forgot/reset').send({ userId, email: VALID.email });
    expect(res.status).toBe(400);
  });
});
