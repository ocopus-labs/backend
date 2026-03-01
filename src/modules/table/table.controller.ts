import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { TableService } from './table.service';
import {
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  StartTableSessionDto,
  EndTableSessionDto,
  AddMaintenanceLogDto,
} from './dto';
import { BusinessRoles, HttpCacheTTL } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { TableStatus } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/tables')
@UsePipes(new ValidationPipe({ transform: true }))
export class TableController {
  private readonly logger = new Logger(TableController.name);

  constructor(private tableService: TableService) {}

  @Post()
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateTableDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const table = await this.tableService.create(
      businessId,
      dto,
      session.user.id,
    );

    return {
      message: 'Table created successfully',
      table,
    };
  }

  @Get()
  @HttpCacheTTL(10)
  async findAll(
    @Param('businessId') businessId: string,
    @Query('status') status: TableStatus | undefined,
    @Session() session: UserSession,
  ) {
    if (status) {
      const tables = await this.tableService.findByStatus(businessId, status);
      return { tables };
    }

    const tables = await this.tableService.findAll(businessId);
    return { tables };
  }

  @Get('stats')
  @HttpCacheTTL(15)
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const stats = await this.tableService.getTableStats(businessId);
    return { stats };
  }

  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const table = await this.tableService.findByIdOrFail(businessId, id);
    return { table };
  }

  @Get('number/:tableNumber')
  async findByTableNumber(
    @Param('businessId') businessId: string,
    @Param('tableNumber') tableNumber: string,
    @Session() session: UserSession,
  ) {
    const table = await this.tableService.findByTableNumber(
      businessId,
      tableNumber,
    );

    if (!table) {
      throw new ForbiddenException('Table not found');
    }

    return { table };
  }

  @Patch(':id')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const table = await this.tableService.update(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Table updated successfully',
      table,
    };
  }

  @Patch(':id/status')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async updateStatus(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const table = await this.tableService.updateStatus(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Table status updated successfully',
      table,
    };
  }

  @Post(':id/session/start')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async startSession(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: StartTableSessionDto,
    @Session() session: UserSession,
  ) {
    const table = await this.tableService.startSession(
      businessId,
      id,
      dto,
      session.user.id,
      session.user.name || 'Unknown',
    );

    return {
      message: 'Table session started',
      table,
    };
  }

  @Post(':id/session/end')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async endSession(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: EndTableSessionDto,
    @Session() session: UserSession,
  ) {
    const table = await this.tableService.endSession(
      businessId,
      id,
      session.user.id,
    );

    return {
      message: 'Table session ended',
      table,
    };
  }

  @Post(':id/maintenance')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async addMaintenanceLog(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: AddMaintenanceLogDto,
    @Session() session: UserSession,
  ) {
    const table = await this.tableService.addMaintenanceLog(
      businessId,
      id,
      dto,
      session.user.id,
      session.user.name || 'Unknown',
    );

    return {
      message: 'Maintenance log added',
      table,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.tableService.delete(businessId, id, session.user.id);

    return {
      message: 'Table deleted successfully',
    };
  }
}
