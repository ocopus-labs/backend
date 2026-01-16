import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { TableService } from './table.service';
import { BusinessService } from 'src/modules/business';
import {
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  StartTableSessionDto,
  EndTableSessionDto,
  AddMaintenanceLogDto,
} from './dto';
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

  constructor(
    private tableService: TableService,
    private businessService: BusinessService,
  ) {}

  /**
   * Create a new table
   */
  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateTableDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

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

  /**
   * List all tables for a business
   */
  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('status') status: TableStatus | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    if (status) {
      const tables = await this.tableService.findByStatus(businessId, status);
      return { tables };
    }

    const tables = await this.tableService.findAll(businessId);
    return { tables };
  }

  /**
   * Get table statistics
   */
  @Get('stats')
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const stats = await this.tableService.getTableStats(businessId);
    return { stats };
  }

  /**
   * Get a table by ID
   */
  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const table = await this.tableService.findByIdOrFail(businessId, id);
    return { table };
  }

  /**
   * Get a table by table number
   */
  @Get('number/:tableNumber')
  async findByTableNumber(
    @Param('businessId') businessId: string,
    @Param('tableNumber') tableNumber: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const table = await this.tableService.findByTableNumber(
      businessId,
      tableNumber,
    );

    if (!table) {
      throw new ForbiddenException('Table not found');
    }

    return { table };
  }

  /**
   * Update a table
   */
  @Patch(':id')
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

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

  /**
   * Update table status
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ]);

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

  /**
   * Start a table session (mark as occupied with order)
   */
  @Post(':id/session/start')
  async startSession(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: StartTableSessionDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ]);

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

  /**
   * End a table session (mark as available)
   */
  @Post(':id/session/end')
  async endSession(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: EndTableSessionDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ]);

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

  /**
   * Add maintenance log entry
   */
  @Post(':id/maintenance')
  async addMaintenanceLog(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: AddMaintenanceLogDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

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

  /**
   * Delete a table
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    await this.tableService.delete(businessId, id, session.user.id);

    return {
      message: 'Table deleted successfully',
    };
  }

  /**
   * Helper to validate business access with optional role check
   */
  private async validateAccess(
    userId: string,
    businessId: string,
    allowedRoles?: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(
      userId,
      businessId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    if (allowedRoles) {
      const role = await this.businessService.getUserRole(userId, businessId);
      if (!role || !allowedRoles.includes(role)) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }
    }
  }
}
