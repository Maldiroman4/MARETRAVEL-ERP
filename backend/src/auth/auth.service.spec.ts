import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        username: 'luis',
        passwordHash:
          '$2b$10$8x.DpUWnnSzXQzdc8CdC6eL7b7uzDhMbxGPCAwcsaXXkI//yWebai',
        name: 'Luis',
        role: 'ADMIN',
        isActive: true,
      }),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('should return token for valid credentials', async () => {
    const result = await service.login('luis', '585858');
    expect(result.access_token).toBe('token');
    expect(result.user.username).toBe('luis');
  });

  it('should throw for invalid password', async () => {
    await expect(service.login('luis', 'wrong')).rejects.toThrow(
      'Credenciales inválidas',
    );
  });
});
