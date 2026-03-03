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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { ReservationService } from './reservation.service';
import { CreateReservationDto, UpdateReservationDto } from './dto';
import { BusinessRoles, HttpCacheTTL } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/reservations')
@UsePipes(new ValidationPipe({ transform: true }))
export class ReservationController {
  constructor(private reservationService: ReservationService) {}

  @Post()
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateReservationDto,
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.create(
      businessId,
      dto,
      session.user.id,
    );

    return {
      message: 'Reservation created successfully',
      reservation,
    };
  }

  @Get()
  @HttpCacheTTL(10)
  async findAll(
    @Param('businessId') businessId: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.reservationService.findAll(businessId, {
      date,
      startDate,
      endDate,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      reservations: result.reservations,
      total: result.total,
    };
  }

  @Get('stats')
  @HttpCacheTTL(15)
  async getStats(@Param('businessId') businessId: string) {
    const stats = await this.reservationService.getStats(businessId);
    return { stats };
  }

  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const reservation = await this.reservationService.findById(businessId, id);
    return { reservation };
  }

  @Patch(':id')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.update(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Reservation updated successfully',
      reservation,
    };
  }

  @Post(':id/confirm')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async confirm(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.confirm(
      businessId,
      id,
      session.user.id,
    );

    return {
      message: 'Reservation confirmed successfully',
      reservation,
    };
  }

  @Post(':id/cancel')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async cancel(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.cancel(
      businessId,
      id,
      session.user.id,
      body.reason,
    );

    return {
      message: 'Reservation cancelled successfully',
      reservation,
    };
  }

  @Post(':id/seat')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async seat(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: { tableId?: string },
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.seat(
      businessId,
      id,
      session.user.id,
      body.tableId,
    );

    return {
      message: 'Reservation seated successfully',
      reservation,
    };
  }

  @Post(':id/complete')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async complete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const reservation = await this.reservationService.complete(
      businessId,
      id,
      session.user.id,
    );

    return {
      message: 'Reservation completed successfully',
      reservation,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.reservationService.delete(
      businessId,
      id,
      session.user.id,
    );

    return {
      message: 'Reservation deleted successfully',
    };
  }
}
