import {
  BusinessUser as PrismaBusinessUser,
  User as PrismaUser,
} from '@prisma/client';

export type BusinessUser = PrismaBusinessUser;
export type User = PrismaUser;

export interface TeamMember {
  id: string;
  userId: string;
  restaurantId: string;
  role: string;
  status: string;
  permissions: string[];
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  token: string;
}

export type TeamMemberStatus = 'active' | 'inactive' | 'suspended';

export const TEAM_MEMBER_STATUSES: Record<string, TeamMemberStatus> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

export interface RoleInfo {
  role: string;
  displayName: string;
  description: string;
  permissions: string[];
  canAssign: string[]; // Which roles can assign this role
}

export const ASSIGNABLE_ROLES = [
  'manager',
  'staff',
  'viewer',
  'accountant',
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
