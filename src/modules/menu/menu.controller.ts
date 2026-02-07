import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { MenuService } from './menu.service';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto';
import { BusinessRoles } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

@Controller('business/:businessId/menu')
@UsePipes(new ValidationPipe({ transform: true }))
export class MenuController {
  private readonly logger = new Logger(MenuController.name);

  constructor(private menuService: MenuService) {}

  // ==================== MENU ====================

  @Get()
  async getMenu(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const menu = await this.menuService.getMenu(businessId);
    return menu;
  }

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async publishMenu(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const menu = await this.menuService.publishMenu(businessId, session.user.id);
    return {
      message: 'Menu published successfully',
      menu,
    };
  }

  // ==================== CATEGORIES ====================

  @Get('categories')
  async getCategories(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const categories = await this.menuService.getCategories(businessId);
    return { categories };
  }

  @Get('categories/:categoryId')
  async getCategoryById(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Session() session: UserSession,
  ) {
    const category = await this.menuService.getCategoryById(businessId, categoryId);
    return { category };
  }

  @Post('categories')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async createCategory(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCategoryDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const category = await this.menuService.createCategory(businessId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Category created successfully',
      category,
    };
  }

  @Patch('categories/:categoryId')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async updateCategory(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const category = await this.menuService.updateCategory(businessId, categoryId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Category updated successfully',
      category,
    };
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async deleteCategory(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    await this.menuService.deleteCategory(businessId, categoryId, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Category deleted successfully',
    };
  }

  @Post('categories/reorder')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async reorderCategories(
    @Param('businessId') businessId: string,
    @Body() dto: ReorderCategoriesDto,
    @Session() session: UserSession,
  ) {
    const categories = await this.menuService.reorderCategories(businessId, dto.categoryIds, session.user.id);
    return {
      message: 'Categories reordered successfully',
      categories,
    };
  }

  // ==================== ITEMS ====================

  @Get('items')
  async getItems(
    @Param('businessId') businessId: string,
    @Query('categoryId') categoryId: string | undefined,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    const result = await this.menuService.getItems(businessId, categoryId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return result;
  }

  @Get('items/:itemId')
  async getItemById(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    const item = await this.menuService.getItemById(businessId, itemId);
    return { item };
  }

  @Post('items')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async createItem(
    @Param('businessId') businessId: string,
    @Body() dto: CreateMenuItemDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const item = await this.menuService.createItem(businessId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Menu item created successfully',
      item,
    };
  }

  @Patch('items/:itemId')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async updateItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const item = await this.menuService.updateItem(businessId, itemId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Menu item updated successfully',
      item,
    };
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async deleteItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    await this.menuService.deleteItem(businessId, itemId, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      message: 'Menu item deleted successfully',
    };
  }

  @Post('items/:itemId/toggle-availability')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async toggleItemAvailability(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    const item = await this.menuService.toggleItemAvailability(businessId, itemId, session.user.id);
    return {
      message: `Item is now ${item.isAvailable ? 'available' : 'unavailable'}`,
      item,
    };
  }

  @Post('items/bulk-availability')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async bulkUpdateAvailability(
    @Param('businessId') businessId: string,
    @Body() body: { itemIds: string[]; isAvailable: boolean },
    @Session() session: UserSession,
  ) {
    const items = await this.menuService.bulkUpdateAvailability(
      businessId,
      body.itemIds,
      body.isAvailable,
      session.user.id,
    );
    return {
      message: `${items.length} items updated`,
      items,
    };
  }

  @Post('seed-categories')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async seedDefaultCategories(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const categories = await this.menuService.seedDefaultCategories(businessId, session.user.id);
    return {
      message: 'Default categories seeded successfully',
      categories,
    };
  }
}
