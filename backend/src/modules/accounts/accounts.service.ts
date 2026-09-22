import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountRating, Prisma, RelationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: { ...dto, rating: dto.rating ?? 'NORMAL' },
    });
  }

  async findAll(
    relationType?: RelationType,
    rating?: AccountRating,
    search?: string,
  ) {
    const where: Prisma.AccountWhereInput = {};
    if (relationType) where.relationType = relationType;
    if (rating) where.rating = rating;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.account.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
      include: { contacts: true },
    });
  }

  async update(id: string, dto: UpdateAccountDto) {
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const linked = await this.prisma.debitNote.count({ where: { accountId: id } });
    if (linked > 0) {
      throw new BadRequestException(
        `La cuenta tiene ${linked} Nota(s) de Débito vinculada(s) en el backend. No se puede eliminar.`,
      );
    }
    try {
      return await this.prisma.account.delete({ where: { id } });
    } catch (err) {
      const e = err as { code?: string };
      if (e && e.code === 'P2003') {
        throw new BadRequestException(
          'La cuenta está referenciada por otros registros. No se puede eliminar.',
        );
      }
      throw err;
    }
  }
}
