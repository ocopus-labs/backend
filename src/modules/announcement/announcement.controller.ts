import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles, Session } from '@thallesp/nestjs-better-auth';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Sanitize } from 'src/lib/common';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

// ==================== ADMIN ENDPOINTS ====================

@Controller('admin/announcements')
@UsePipes(new ValidationPipe({ transform: true }))
@Roles([USER_ROLES.SUPER_ADMIN])
@Sanitize()
export class AdminAnnouncementController {
  constructor(private announcementService: AnnouncementService) {}

  /**
   * List all announcements (paginated, includes inactive/expired)
   */
  @Get()
  async getAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.announcementService.getAll(page, limit);
  }

  /**
   * Create a new announcement
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAnnouncementDto,
    @Session() session: UserSession,
  ) {
    const announcement = await this.announcementService.create(dto, session.user.id);
    return { message: 'Announcement created successfully', announcement };
  }

  /**
   * Update an announcement
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    const announcement = await this.announcementService.update(id, dto);
    return { message: 'Announcement updated successfully', announcement };
  }

  /**
   * Delete an announcement
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.announcementService.remove(id);
  }

  /**
   * Toggle publish status (isActive)
   */
  @Patch(':id/publish')
  @HttpCode(HttpStatus.OK)
  async togglePublish(@Param('id') id: string) {
    const announcement = await this.announcementService.togglePublish(id);
    return {
      message: `Announcement ${announcement.isActive ? 'published' : 'unpublished'} successfully`,
      announcement,
    };
  }
}

// ==================== USER ENDPOINTS ====================

@Controller('announcements')
@UsePipes(new ValidationPipe({ transform: true }))
@Sanitize()
export class UserAnnouncementController {
  constructor(private announcementService: AnnouncementService) {}

  /**
   * Get active announcements for the current user
   */
  @Get('active')
  async getActive(@Session() session: UserSession) {
    const announcements = await this.announcementService.getActiveForUser(
      session.user.id,
      session.user.role,
    );
    return { announcements };
  }

  /**
   * Dismiss an announcement for the current user
   */
  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.announcementService.dismiss(id, session.user.id);
  }
}
