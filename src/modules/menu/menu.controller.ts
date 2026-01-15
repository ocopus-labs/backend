import {
  Controller,
  Get,
  Post,
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
import { MenuService } from './menu.service';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto';
import { BusinessService } from '../business/business.service';
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

  constructor(
    private menuService: MenuService,
    private businessService: BusinessService,
  ) {}

  /**
   * Validate user has access to business
   */
  private async validateAccess(userId: string, businessId: string): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  /**
   * Validate user has write access (manager+)
   */
  private async validateWriteAccess(userId: string, businessId: string): Promise<void> {
    await this.validateAccess(userId, businessId);
    const role = await this.businessService.getUserRole(userId, businessId);
    const writeRoles: string[] = [
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.MANAGER,
    ];
    if (!role || !writeRoles.includes(role)) {
      throw new ForbiddenException('You do not have permission to modify the menu');
    }
  }

  // ==================== MENU ====================

  /**
   * Get full menu (categories + items)
   */
  @Get()
  async getMenu(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    const menu = await this.menuService.getMenu(businessId);
    return menu;
  }

  /**
   * Publish menu (increment version)
   */
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  async publishMenu(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const menu = await this.menuService.publishMenu(businessId, session.user.id);
    return {
      message: 'Menu published successfully',
      menu,
    };
  }

  // ==================== CATEGORIES ====================

  /**
   * Get all categories
   */
  @Get('categories')
  async getCategories(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    const categories = await this.menuService.getCategories(businessId);
    return { categories };
  }

  /**
   * Get category by ID
   */
  @Get('categories/:categoryId')
  async getCategoryById(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    const category = await this.menuService.getCategoryById(businessId, categoryId);
    return { category };
  }

  /**
   * Create a new category
   */
  @Post('categories')
  async createCategory(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCategoryDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const category = await this.menuService.createCategory(businessId, dto, session.user.id);
    return {
      message: 'Category created successfully',
      category,
    };
  }

  /**
   * Update a category
   */
  @Patch('categories/:categoryId')
  async updateCategory(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const category = await this.menuService.updateCategory(businessId, categoryId, dto, session.user.id);
    return {
      message: 'Category updated successfully',
      category,
    };
  }

  /**
   * Delete a category
   */
  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(
    @Param('businessId') businessId: string,
    @Param('categoryId') categoryId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    await this.menuService.deleteCategory(businessId, categoryId, session.user.id);
    return {
      message: 'Category deleted successfully',
    };
  }

  /**
   * Reorder categories
   */
  @Post('categories/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderCategories(
    @Param('businessId') businessId: string,
    @Body() dto: ReorderCategoriesDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const categories = await this.menuService.reorderCategories(businessId, dto.categoryIds, session.user.id);
    return {
      message: 'Categories reordered successfully',
      categories,
    };
  }

  // ==================== ITEMS ====================

  /**
   * Get all items (optionally filtered by category)
   */
  @Get('items')
  async getItems(
    @Param('businessId') businessId: string,
    @Query('categoryId') categoryId: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    const items = await this.menuService.getItems(businessId, categoryId);
    return { items };
  }

  /**
   * Get item by ID
   */
  @Get('items/:itemId')
  async getItemById(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    const item = await this.menuService.getItemById(businessId, itemId);
    return { item };
  }

  /**
   * Create a new menu item
   */
  @Post('items')
  async createItem(
    @Param('businessId') businessId: string,
    @Body() dto: CreateMenuItemDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const item = await this.menuService.createItem(businessId, dto, session.user.id);
    return {
      message: 'Menu item created successfully',
      item,
    };
  }

  /**
   * Update a menu item
   */
  @Patch('items/:itemId')
  async updateItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const item = await this.menuService.updateItem(businessId, itemId, dto, session.user.id);
    return {
      message: 'Menu item updated successfully',
      item,
    };
  }

  /**
   * Delete a menu item
   */
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    await this.menuService.deleteItem(businessId, itemId, session.user.id);
    return {
      message: 'Menu item deleted successfully',
    };
  }

  /**
   * Toggle item availability
   */
  @Post('items/:itemId/toggle-availability')
  @HttpCode(HttpStatus.OK)
  async toggleItemAvailability(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const item = await this.menuService.toggleItemAvailability(businessId, itemId, session.user.id);
    return {
      message: `Item is now ${item.isAvailable ? 'available' : 'unavailable'}`,
      item,
    };
  }

  /**
   * Bulk update item availability
   */
  @Post('items/bulk-availability')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateAvailability(
    @Param('businessId') businessId: string,
    @Body() body: { itemIds: string[]; isAvailable: boolean },
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
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

  /**
   * Seed default categories for a new business
   */
  @Post('seed-categories')
  @HttpCode(HttpStatus.OK)
  async seedDefaultCategories(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    const categories = await this.menuService.seedDefaultCategories(businessId, session.user.id);
    return {
      message: 'Default categories seeded successfully',
      categories,
    };
  }
}
