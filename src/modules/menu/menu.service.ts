import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CloudinaryService } from 'src/lib/common/upload/cloudinary.service';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';
import { MenuItem, MenuCategory, MenuData, MenuResponse } from './interfaces';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Upload image to Cloudinary if it's a base64 string
   */
  private async processImage(imageData?: string): Promise<string | undefined> {
    if (!imageData) return undefined;

    // Reject blob URLs - they are browser-only and cannot be processed server-side
    if (imageData.startsWith('blob:')) {
      throw new BadRequestException(
        'Blob URLs are not supported. Please upload the image as base64 data.',
      );
    }

    // If it's a base64 data URL, upload to Cloudinary
    if (imageData.startsWith('data:')) {
      try {
        const uploadResult = await this.cloudinaryService.uploadImage(
          imageData,
          'menu-items',
        );
        return uploadResult.url;
      } catch (error) {
        this.logger.error('Failed to upload menu item image:', error);
        throw new BadRequestException('Failed to upload image');
      }
    }

    // If it's already a URL, return as-is
    return imageData;
  }

  /**
   * Get full menu for a business
   */
  async getMenu(businessId: string): Promise<MenuResponse> {
    const menuRecord = await this.prisma.menuItem.findFirst({
      where: { restaurantId: businessId },
    });

    if (!menuRecord) {
      return {
        categories: [],
        items: [],
        totalCategories: 0,
        totalItems: 0,
        menuVersion: 1.0,
        lastPublished: undefined,
      };
    }

    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    return {
      categories,
      items,
      totalCategories: categories.length,
      totalItems: items.length,
      menuVersion: Number(menuRecord.menuVersion),
      lastPublished: menuRecord.lastPublished?.toISOString(),
    };
  }

  /**
   * Get or create menu record for a business
   */
  private async getOrCreateMenuRecord(businessId: string) {
    let menuRecord = await this.prisma.menuItem.findFirst({
      where: { restaurantId: businessId },
    });

    if (!menuRecord) {
      menuRecord = await this.prisma.menuItem.create({
        data: {
          restaurantId: businessId,
          categories: { categories: [], items: [] },
          menuVersion: 1.0,
        },
      });
    }

    return menuRecord;
  }

  /**
   * Save menu data
   */
  private async saveMenuData(
    menuId: string,
    menuData: MenuData,
  ): Promise<void> {
    await this.prisma.menuItem.update({
      where: { id: menuId },
      data: {
        categories: menuData as object,
      },
    });
  }

  // ==================== CATEGORY OPERATIONS ====================

  /**
   * Get all categories
   */
  async getCategories(businessId: string): Promise<MenuCategory[]> {
    const menu = await this.getMenu(businessId);
    return menu.categories;
  }

  /**
   * Get category by ID
   */
  async getCategoryById(
    businessId: string,
    categoryId: string,
  ): Promise<MenuCategory> {
    const menu = await this.getMenu(businessId);
    const category = menu.categories.find((c) => c.id === categoryId);

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    return category;
  }

  /**
   * Create a new category
   */
  async createCategory(
    businessId: string,
    dto: CreateCategoryDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<MenuCategory> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    // Process image (upload to Cloudinary if base64)
    const imageUrl = await this.processImage(dto.image);

    const now = new Date().toISOString();
    const newCategory: MenuCategory = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      image: imageUrl,
      sortOrder: dto.sortOrder ?? categories.length + 1,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    categories.push(newCategory);

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'CREATE',
      'menu_category',
      { categoryId: newCategory.id, name: newCategory.name },
      context,
    );

    this.logger.log(
      `Category created: ${newCategory.name} (${newCategory.id}) for business ${businessId}`,
    );
    return newCategory;
  }

  /**
   * Update a category
   */
  async updateCategory(
    businessId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<MenuCategory> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    const categoryIndex = categories.findIndex((c) => c.id === categoryId);
    if (categoryIndex === -1) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Process image (upload to Cloudinary if base64)
    const imageUrl =
      dto.image !== undefined
        ? await this.processImage(dto.image)
        : categories[categoryIndex].image;

    const updatedCategory: MenuCategory = {
      ...categories[categoryIndex],
      ...dto,
      image: imageUrl,
      updatedAt: new Date().toISOString(),
    };

    categories[categoryIndex] = updatedCategory;

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'UPDATE',
      'menu_category',
      { categoryId, updatedFields: Object.keys(dto) },
      context,
    );

    return updatedCategory;
  }

  /**
   * Delete a category
   */
  async deleteCategory(
    businessId: string,
    categoryId: string,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    let categories = menuData?.categories || [];
    const items = menuData?.items || [];

    const categoryIndex = categories.findIndex((c) => c.id === categoryId);
    if (categoryIndex === -1) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Check if category has items
    const categoryItems = items.filter((i) => i.categoryId === categoryId);
    if (categoryItems.length > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${categoryItems.length} items. Move or delete items first.`,
      );
    }

    categories = categories.filter((c) => c.id !== categoryId);

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'DELETE',
      'menu_category',
      { categoryId },
      context,
    );

    this.logger.log(
      `Category deleted: ${categoryId} for business ${businessId}`,
    );
  }

  /**
   * Reorder categories
   */
  async reorderCategories(
    businessId: string,
    categoryIds: string[],
    userId: string,
  ): Promise<MenuCategory[]> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    // Reorder based on provided IDs
    const reorderedCategories = categoryIds
      .map((id, index) => {
        const category = categories.find((c) => c.id === id);
        if (category) {
          return {
            ...category,
            sortOrder: index + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return null;
      })
      .filter((c): c is MenuCategory => c !== null);

    await this.saveMenuData(menuRecord.id, {
      categories: reorderedCategories,
      items,
    });
    await this.createAuditLog(
      businessId,
      userId,
      'REORDER',
      'menu_categories',
      {},
    );

    return reorderedCategories;
  }

  // ==================== MENU ITEM OPERATIONS ====================

  /**
   * Get all items
   */
  async getItems(
    businessId: string,
    categoryId?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: MenuItem[]; total: number }> {
    const menu = await this.getMenu(businessId);
    let items = menu.items;

    if (categoryId) {
      items = items.filter((i) => i.categoryId === categoryId);
    }

    items = items.sort((a, b) => a.sortOrder - b.sortOrder);
    const total = items.length;

    if (options?.offset !== undefined) {
      items = items.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      items = items.slice(0, options.limit);
    }

    return { items, total };
  }

  /**
   * Get item by ID
   */
  async getItemById(businessId: string, itemId: string): Promise<MenuItem> {
    const menu = await this.getMenu(businessId);
    const item = menu.items.find((i) => i.id === itemId);

    if (!item) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }

    return item;
  }

  /**
   * Create a new menu item
   */
  async createItem(
    businessId: string,
    dto: CreateMenuItemDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<MenuItem> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    // Validate category exists
    const categoryExists = categories.some((c) => c.id === dto.categoryId);
    if (!categoryExists) {
      throw new BadRequestException(
        `Category with ID ${dto.categoryId} not found`,
      );
    }

    // Process image (upload to Cloudinary if base64)
    const imageUrl = await this.processImage(dto.image);

    const now = new Date().toISOString();
    const categoryItems = items.filter((i) => i.categoryId === dto.categoryId);

    const newItem: MenuItem = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      price: dto.price,
      image: imageUrl,
      categoryId: dto.categoryId,
      isAvailable: dto.isAvailable ?? true,
      isVegetarian: dto.isVegetarian,
      isVegan: dto.isVegan,
      isGlutenFree: dto.isGlutenFree,
      preparationTime: dto.preparationTime,
      sortOrder: dto.sortOrder ?? categoryItems.length + 1,
      modifiers: dto.modifiers,
      createdAt: now,
      updatedAt: now,
    };

    items.push(newItem);

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'CREATE',
      'menu_item',
      { itemId: newItem.id, name: newItem.name },
      context,
    );

    this.logger.log(
      `Menu item created: ${newItem.name} (${newItem.id}) for business ${businessId}`,
    );
    return newItem;
  }

  /**
   * Update a menu item
   */
  async updateItem(
    businessId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<MenuItem> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    const itemIndex = items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }

    // If changing category, validate new category exists
    if (dto.categoryId) {
      const categoryExists = categories.some((c) => c.id === dto.categoryId);
      if (!categoryExists) {
        throw new BadRequestException(
          `Category with ID ${dto.categoryId} not found`,
        );
      }
    }

    // Process image (upload to Cloudinary if base64)
    const imageUrl =
      dto.image !== undefined
        ? await this.processImage(dto.image)
        : items[itemIndex].image;

    const updatedItem: MenuItem = {
      ...items[itemIndex],
      ...dto,
      image: imageUrl,
      updatedAt: new Date().toISOString(),
    };

    items[itemIndex] = updatedItem;

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'UPDATE',
      'menu_item',
      { itemId, updatedFields: Object.keys(dto) },
      context,
    );

    return updatedItem;
  }

  /**
   * Delete a menu item
   */
  async deleteItem(
    businessId: string,
    itemId: string,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    let items = menuData?.items || [];

    const itemIndex = items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }

    items = items.filter((i) => i.id !== itemId);

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(
      businessId,
      userId,
      'DELETE',
      'menu_item',
      { itemId },
      context,
    );

    this.logger.log(`Menu item deleted: ${itemId} for business ${businessId}`);
  }

  /**
   * Toggle item availability
   */
  async toggleItemAvailability(
    businessId: string,
    itemId: string,
    userId: string,
  ): Promise<MenuItem> {
    const item = await this.getItemById(businessId, itemId);
    return this.updateItem(
      businessId,
      itemId,
      { isAvailable: !item.isAvailable },
      userId,
    );
  }

  /**
   * Bulk update item availability
   */
  async bulkUpdateAvailability(
    businessId: string,
    itemIds: string[],
    isAvailable: boolean,
    userId: string,
  ): Promise<MenuItem[]> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];

    const updatedItems: MenuItem[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      if (itemIds.includes(item.id)) {
        item.isAvailable = isAvailable;
        item.updatedAt = now;
        updatedItems.push(item);
      }
    }

    await this.saveMenuData(menuRecord.id, { categories, items });
    await this.createAuditLog(businessId, userId, 'BULK_UPDATE', 'menu_items', {
      itemIds,
      isAvailable,
    });

    return updatedItems;
  }

  /**
   * Publish menu (update version)
   */
  async publishMenu(businessId: string, userId: string): Promise<MenuResponse> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);

    const currentVersion = Number(menuRecord.menuVersion);
    const newVersion = Math.round((currentVersion + 0.1) * 10) / 10;

    await this.prisma.menuItem.update({
      where: { id: menuRecord.id },
      data: {
        menuVersion: newVersion,
        lastPublished: new Date(),
      },
    });

    await this.createAuditLog(businessId, userId, 'PUBLISH', 'menu', {
      version: newVersion,
    });

    this.logger.log(
      `Menu published: version ${newVersion} for business ${businessId}`,
    );
    return this.getMenu(businessId);
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    businessId: string,
    userId: string,
    action: string,
    resource: string,
    details: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId: businessId,
        userId,
        action,
        resource,
        details: details as object,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }

  /**
   * Seed default categories for a business
   */
  async seedDefaultCategories(
    businessId: string,
    userId: string,
  ): Promise<MenuCategory[]> {
    const existingMenu = await this.getMenu(businessId);

    // Don't seed if categories already exist
    if (existingMenu.categories.length > 0) {
      this.logger.log(
        `Business ${businessId} already has categories, skipping seed`,
      );
      return existingMenu.categories;
    }

    // Look up business type for context-appropriate categories
    const business = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { type: true },
    });
    const businessType = (business?.type || 'restaurant').toLowerCase();

    const categoryMap: Record<string, { name: string; description: string }[]> =
      {
        restaurant: [
          {
            name: 'Appetizers',
            description: 'Start your meal with these delicious appetizers',
          },
          { name: 'Main Course', description: 'Hearty main dishes' },
          { name: 'Beverages', description: 'Refreshing drinks' },
          { name: 'Desserts', description: 'Sweet treats to end your meal' },
          { name: 'Sides', description: 'Perfect accompaniments' },
        ],
        cafe: [
          {
            name: 'Hot Drinks',
            description: 'Coffee, tea, and other hot beverages',
          },
          {
            name: 'Cold Drinks',
            description: 'Iced coffees, smoothies, and cold beverages',
          },
          { name: 'Pastries', description: 'Fresh baked goods and pastries' },
          { name: 'Sandwiches', description: 'Light meals and sandwiches' },
          { name: 'Snacks', description: 'Quick bites and light snacks' },
        ],
        bar: [
          { name: 'Cocktails', description: 'Signature and classic cocktails' },
          { name: 'Beer', description: 'Draft and bottled beers' },
          { name: 'Wine', description: 'Red, white, and sparkling wines' },
          { name: 'Spirits', description: 'Premium spirits and liquors' },
          { name: 'Bar Snacks', description: 'Appetizers and bar bites' },
        ],
        salon: [
          {
            name: 'Haircuts',
            description: 'Hair cutting and styling services',
          },
          { name: 'Coloring', description: 'Hair coloring and highlights' },
          { name: 'Treatments', description: 'Hair and scalp treatments' },
          {
            name: 'Styling',
            description: 'Blowouts and special occasion styling',
          },
          { name: 'Products', description: 'Retail hair care products' },
        ],
        gym: [
          { name: 'Memberships', description: 'Gym membership plans' },
          {
            name: 'Personal Training',
            description: 'One-on-one training sessions',
          },
          { name: 'Group Classes', description: 'Fitness group classes' },
          {
            name: 'Supplements',
            description: 'Nutrition and supplement products',
          },
          { name: 'Merchandise', description: 'Gym apparel and accessories' },
        ],
        retail: [
          {
            name: 'New Arrivals',
            description: 'Latest products and new stock',
          },
          { name: 'Best Sellers', description: 'Top-selling products' },
          { name: 'Sale', description: 'Discounted items on sale' },
          { name: 'Accessories', description: 'Add-on accessories and extras' },
          { name: 'Gift Cards', description: 'Gift cards and vouchers' },
        ],
        clinic: [
          {
            name: 'Consultations',
            description: 'Medical consultations and check-ups',
          },
          {
            name: 'Treatments',
            description: 'Medical treatments and procedures',
          },
          { name: 'Lab Tests', description: 'Diagnostic and laboratory tests' },
          { name: 'Medications', description: 'Prescribed medications' },
          {
            name: 'Wellness',
            description: 'Preventive care and wellness packages',
          },
        ],
        hotel: [
          { name: 'Room Service', description: 'In-room dining menu' },
          { name: 'Breakfast', description: 'Morning breakfast options' },
          { name: 'Lunch & Dinner', description: 'Main dining courses' },
          { name: 'Beverages', description: 'Drinks and refreshments' },
          { name: 'Mini Bar', description: 'In-room mini bar selections' },
        ],
        spa: [
          { name: 'Massages', description: 'Massage therapy services' },
          { name: 'Facials', description: 'Facial treatments and skincare' },
          {
            name: 'Body Treatments',
            description: 'Body wraps, scrubs, and treatments',
          },
          { name: 'Packages', description: 'Spa day packages and combos' },
          { name: 'Products', description: 'Skincare and wellness products' },
        ],
      };

    const defaultCategories =
      categoryMap[businessType] || categoryMap['restaurant'];

    const createdCategories: MenuCategory[] = [];

    for (const cat of defaultCategories) {
      const category = await this.createCategory(
        businessId,
        { name: cat.name, description: cat.description },
        userId,
      );
      createdCategories.push(category);
    }

    this.logger.log(
      `Seeded ${createdCategories.length} ${businessType} categories for business ${businessId}`,
    );
    return createdCategories;
  }
}
