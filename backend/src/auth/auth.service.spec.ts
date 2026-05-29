import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

const mockUsersService = {
  findByEmail: jest.fn(),
  saveResetToken: jest.fn(),
  findByResetToken: jest.fn(),
  updatePassword: jest.fn(),
  validatePassword: jest.fn(),
  saveRefreshToken: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  toPublic: jest.fn((u) => u),
};

const mockJwtService = {
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }),
};

const mockMailService = {
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('returns generic message when email does not exist (prevents enumeration)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword('unknown@example.com');
      expect(result.message).toContain('If that email exists');
      expect((result as any).reset_url).toBeUndefined();
    });

    it('sends email via MailService when user exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
      mockUsersService.saveResetToken.mockResolvedValue(undefined);

      const result = await service.forgotPassword('user@example.com');

      expect(mockMailService.sendPasswordReset).toHaveBeenCalledTimes(1);
      const [emailArg, urlArg] = mockMailService.sendPasswordReset.mock.calls[0];
      expect(emailArg).toBe('user@example.com');
      expect(urlArg).toContain('/reset-password?token=');
      expect(result.message).toContain('If that email exists');
      expect((result as any).reset_url).toBeUndefined();
    });
  });
});
