import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';
import { CreateApiKeyDto } from './dto';
import {
  getRolePermissions,
  type UserRole,
} from 'src/lib/auth/roles.constants';

const KEY_PREFIX = 'pos_k_';
const MAX_KEYS_DEFAULT = 5;

interface ValidatedApiKey {
  id: string;
  name: string;
  userId: string;
  restaurantId: string;
  scopes: string[];
  permissions: string[];
  rateLimit: number;
  userName: string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(
    userId: string,
    restaurantId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ key: string; apiKey: Record<string, unknown> }> {
    // Verify user has access to business
    const businessUser = await this.prisma.businessUser.findFirst({
      where: { userId, restaurantId, status: 'active' },
    });

    if (!businessUser) {
      throw new ForbiddenException('You do not have access to this business');
    }

    // Check permission ceiling: key permissions can't exceed user's role permissions
    const userPermissions = getRolePermissions(businessUser.role as UserRole);
    const exceeding = dto.permissions.filter(
      (p) => !userPermissions.includes(p),
    );
    if (exceeding.length > 0) {
      throw new BadRequestException(
        `Your role cannot grant these permissions: ${exceeding.join(', ')}`,
      );
    }

    // Check max keys per business
    const existingCount = await this.prisma.apiKey.count({
      where: { restaurantId, isActive: true },
    });
    if (existingCount >= MAX_KEYS_DEFAULT) {
      throw new BadRequestException(
        `Maximum of ${MAX_KEYS_DEFAULT} active API keys per business`,
      );
    }

    // Generate key
    const rawKey = KEY_PREFIX + randomBytes(16).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyPrefix,
        keyHash,
        userId,
        restaurantId,
        scopes: dto.scopes,
        permissions: dto.permissions,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { key: rawKey, apiKey };
  }

  async validate(rawKey: string): Promise<ValidatedApiKey> {
    if (!rawKey.startsWith(KEY_PREFIX)) {
      throw new BadRequestException('Invalid API key format');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!apiKey) {
      throw new BadRequestException('Invalid API key');
    }

    if (!apiKey.isActive) {
      throw new ForbiddenException('API key has been revoked');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new ForbiddenException('API key has expired');
    }

    // Update lastUsedAt (non-blocking)
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) =>
        this.logger.warn(`Failed to update lastUsedAt: ${err.message}`),
      );

    return {
      id: apiKey.id,
      name: apiKey.name,
      userId: apiKey.userId,
      restaurantId: apiKey.restaurantId,
      scopes: apiKey.scopes,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      userName: apiKey.user.name || apiKey.user.email,
    };
  }

  async list(
    userId: string,
    restaurantId: string,
  ): Promise<Record<string, unknown>[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { restaurantId, userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  }

  async revoke(keyId: string, userId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }

  async rotate(
    keyId: string,
    userId: string,
  ): Promise<{ key: string; apiKey: Record<string, unknown> }> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException('API key not found or already revoked');
    }

    // Deactivate old key
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    // Create new key with same config
    return this.generate(userId, existing.restaurantId, {
      name: existing.name,
      scopes: existing.scopes,
      permissions: existing.permissions,
      expiresAt: existing.expiresAt?.toISOString(),
    });
  }
}
