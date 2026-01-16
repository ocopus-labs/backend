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
import { TeamService } from './team.service';
import { BusinessService } from 'src/modules/business';
import {
  InviteTeamMemberDto,
  AddExistingUserDto,
  UpdateTeamMemberDto,
  UpdateMemberRoleDto,
  UpdateMemberPermissionsDto,
  SuspendMemberDto,
} from './dto';
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

  constructor(
    private teamService: TeamService,
    private businessService: BusinessService,
  ) {}

  /**
   * Get all team members
   */
  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('status') status: TeamMemberStatus | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    if (status) {
      const members = await this.teamService.findByStatus(businessId, status);
      return { members };
    }

    const members = await this.teamService.findAll(businessId);
    return { members };
  }

  /**
   * Get team statistics
   */
  @Get('stats')
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const stats = await this.teamService.getTeamStats(businessId);
    return { stats };
  }

  /**
   * Get available roles
   */
  @Get('roles')
  async getRoles(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const roles = this.teamService.getRolesInfo();
    return { roles };
  }

  /**
   * Get a team member by ID
   */
  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const member = await this.teamService.findByIdOrFail(businessId, id);
    return { member };
  }

  /**
   * Invite a new team member by email
   */
  @Post('invite')
  async invite(
    @Param('businessId') businessId: string,
    @Body() dto: InviteTeamMemberDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const result = await this.teamService.inviteByEmail(
      businessId,
      dto,
      session.user.id,
    );

    return {
      message: result.invitation.status === 'added'
        ? 'User added to team successfully'
        : 'Invitation sent successfully',
      ...result,
    };
  }

  /**
   * Add an existing user to the team
   */
  @Post('add')
  async addExistingUser(
    @Param('businessId') businessId: string,
    @Body() dto: AddExistingUserDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const member = await this.teamService.addExistingUser(
      businessId,
      dto,
      session.user.id,
    );

    return {
      message: 'Team member added successfully',
      member,
    };
  }

  /**
   * Update a team member
   */
  @Patch(':id')
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

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

  /**
   * Update member role
   */
  @Patch(':id/role')
  async updateRole(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

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

  /**
   * Update member permissions
   */
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberPermissionsDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

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

  /**
   * Suspend a team member
   */
  @Post(':id/suspend')
  async suspend(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: SuspendMemberDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

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

  /**
   * Reactivate a team member
   */
  @Post(':id/reactivate')
  async reactivate(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

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

  /**
   * Remove a team member
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    await this.teamService.remove(businessId, id, session.user.id);

    return {
      message: 'Team member removed successfully',
    };
  }

  /**
   * Helper to validate business access
   */
  private async validateAccess(
    userId: string,
    businessId: string,
    allowedRoles?: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    if (allowedRoles) {
      const role = await this.businessService.getUserRole(userId, businessId);
      if (!role || !allowedRoles.includes(role)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }
  }
}
