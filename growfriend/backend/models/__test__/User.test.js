const User = require('../User');

const VALID = {
  name: 'Alice',
  email: 'alice@aucklanduni.ac.nz',
  passwordHash: 'SecurePass1',
  securityQuestionCode: 'MOTHER_NAME',
  securityAnswerHash: 'mum'
};

describe('User model', () => {
  it('creates a valid user with correct defaults', async () => {
    const user = await User.create(VALID);
    expect(user.coins).toBe(30);
    expect(user.roles).toEqual(['USER']);
    expect(user.avatar).toBe('');
    expect(user.activePetId).toBeNull();
  });

  it('stores email as lowercase', async () => {
    const user = await User.create({ ...VALID, email: 'Alice@AucklandUni.ac.nz' });
    expect(user.email).toBe('alice@aucklanduni.ac.nz');
  });

  it('hashes password on save', async () => {
    await User.create(VALID);
    const found = await User.findOne({ email: VALID.email }).select('+passwordHash');
    expect(found.passwordHash).not.toBe('SecurePass1');
    expect(found.passwordHash).toMatch(/^\$2/);
  });

  it('hashes security answer on save', async () => {
    await User.create(VALID);
    const found = await User.findOne({ email: VALID.email }).select('+securityAnswerHash');
    expect(found.securityAnswerHash).not.toBe('mum');
    expect(found.securityAnswerHash).toMatch(/^\$2/);
  });

  it('comparePassword returns true for correct password', async () => {
    await User.create(VALID);
    const user = await User.findOne({ email: VALID.email }).select('+passwordHash');
    await expect(user.comparePassword('SecurePass1')).resolves.toBe(true);
  });

  it('comparePassword returns false for wrong password', async () => {
    await User.create(VALID);
    const user = await User.findOne({ email: VALID.email }).select('+passwordHash');
    await expect(user.comparePassword('wrongpassword')).resolves.toBe(false);
  });

  it('rejects duplicate emails', async () => {
    await User.create(VALID);
    await expect(User.create(VALID)).rejects.toMatchObject({ code: 11000 });
  });

  it.each(['name', 'email', 'passwordHash', 'securityQuestionCode', 'securityAnswerHash'])(
    'rejects missing required field: %s',
    async (field) => {
      const { [field]: _omit, ...data } = VALID;
      await expect(new User(data).validate()).rejects.toThrow();
    }
  );
});
