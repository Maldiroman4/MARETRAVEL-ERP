import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountRating, RelationType } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private service: AccountsService) {}

  @Get()
  findAll(
    @Query('relationType') relationType?: RelationType,
    @Query('rating') rating?: AccountRating,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(relationType, rating, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.update(id, dto);
  }
}
