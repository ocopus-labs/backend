import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { Session } from 'src/lib/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto';

@Controller('business/:businessId/api-keys')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Session() session: { user: { id: string } },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.generate(session.user.id, businessId, dto);
  }

  @Get()
  async list(
    @Param('businessId') businessId: string,
    @Session() session: { user: { id: string } },
  ) {
    return this.apiKeyService.list(session.user.id, businessId);
  }

  @Delete(':keyId')
  async revoke(
    @Param('keyId') keyId: string,
    @Session() session: { user: { id: string } },
  ) {
    await this.apiKeyService.revoke(keyId, session.user.id);
    return { message: 'API key revoked' };
  }

  @Post(':keyId/rotate')
  async rotate(
    @Param('keyId') keyId: string,
    @Session() session: { user: { id: string } },
  ) {
    return this.apiKeyService.rotate(keyId, session.user.id);
  }
}
