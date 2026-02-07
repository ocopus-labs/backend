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
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Session } from '@thallesp/nestjs-better-auth';
import { TeamService } from './team.service';
import {
  InviteTeamMemberDto,
  AddExistingUserDto,
  UpdateTeamMemberDto,
  UpdateMemberRoleDto,
  UpdateMemberPermissionsDto,
  SuspendMemberDto,
} from './dto';
import { BusinessRoles, generateCsv } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { TeamMemberStatus } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/team')
@UsePipes(new ValidationPipe({ transform: true }))
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private teamService: TeamService) {}

  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('status') status: TeamMemberStatus | undefined,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;

    if (status) {
      const result = await this.teamService.findByStatus(businessId, status, parsedLimit, parsedOffset);
      return result;
    }

    const result = await this.teamService.findAll(businessId, parsedLimit, parsedOffset);
    return result;
  }

  @Get('export')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async exportTeam(
    @Param('businessId') businessId: string,
    @Res() res?: Response,
  ) {
    const result = await this.teamService.findAll(businessId, 10000, 0);
    const members = result.members || [];

    const headers = ['Name', 'Email', 'Role', 'Status', 'Joined Date'];
    const rows = members.map((m: any) => [
      m.user?.name || '',
      m.user?.email || '',
      m.role || '',
      m.status || '',
      m.joinedAt ? new Date(m.joinedAt).toISOString().split('T')[0] : '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="team-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('stats')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const stats = await this.teamService.getTeamStats(businessId);
    return { stats };
  }

  @Get('roles')
  async getRoles(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const roles = this.teamService.getRolesInfo();
    return { roles };
  }

  @Get('permissions')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async getPermissionTree(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    return this.teamService.getPermissionTree(businessId);
  }

  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const member = await this.teamService.findByIdOrFail(businessId, id);
    return { member };
  }

  @Post('invite')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async invite(
    @Param('businessId') businessId: string,
    @Body() dto: InviteTeamMemberDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const result = await this.teamService.inviteByEmail(
      businessId,
      dto,
      session.user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: result.invitation.status === 'added'
        ? 'User added to team successfully'
        : 'Invitation sent successfully',
      ...result,
    };
  }

  @Post('add')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async addExistingUser(
    @Param('businessId') businessId: string,
    @Body() dto: AddExistingUserDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const member = await this.teamService.addExistingUser(
      businessId,
      dto,
      session.user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Team member added successfully',
      member,
    };
  }

  @Patch(':id')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const member = await this.teamService.update(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Team member updated successfully',
      member,
    };
  }

  @Patch(':id/role')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async updateRole(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
    @Session() session: UserSession,
  ) {
    const member = await this.teamService.updateRole(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Role updated successfully',
      member,
    };
  }

  @Patch(':id/permissions')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async updatePermissions(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberPermissionsDto,
    @Session() session: UserSession,
  ) {
    const member = await this.teamService.updatePermissions(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Permissions updated successfully',
      member,
    };
  }

  @Post(':id/suspend')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async suspend(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: SuspendMemberDto,
    @Session() session: UserSession,
  ) {
    const member = await this.teamService.suspend(
      businessId,
      id,
      session.user.id,
      dto.reason,
    );

    return {
      message: 'Team member suspended',
      member,
    };
  }

  @Post(':id/reactivate')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async reactivate(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const member = await this.teamService.reactivate(
      businessId,
      id,
      session.user.id,
    );

    return {
      message: 'Team member reactivated',
      member,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async remove(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.teamService.remove(businessId, id, session.user.id);

    return {
      message: 'Team member removed successfully',
    };
  }
}
