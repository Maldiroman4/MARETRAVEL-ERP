import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = {
    account: {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'a1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Cliente X' }]),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AccountsService);
  });

  it('creates an account', async () => {
    const dto = {
      code: 'CLI-001',
      name: 'Cliente X',
      relationType: 'CLIENTE',
      accountType: 'PERSONA',
    } as CreateAccountDto;
    const created = await service.create(dto);
    expect(created.id).toBe('a1');
    expect(created.name).toBe('Cliente X');
  });

  it('lists accounts filtered by relationType', async () => {
    await service.findAll('CLIENTE', undefined, undefined);
    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          relationType: 'CLIENTE',
        }) as Prisma.AccountWhereInput,
      }),
    );
  });
});
