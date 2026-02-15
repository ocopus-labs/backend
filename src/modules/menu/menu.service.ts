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
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  MenuItemIngredientDto,
} from './dto';
import {
  MenuItem,
  MenuCategory,
  MenuData,
  MenuResponse,
  ModifierGroup,
  ModifierGroupOption,
  MenuItemIngredient,
} from './interfaces';
import { InventoryService } from '../inventory/inventory.service';
import type { LinkedMenuItem } from '../inventory/interfaces';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private inventoryService: InventoryService,
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
   * Resolve ingredient DTOs into full MenuItemIngredient objects
   */
  private async resolveIngredients(
    businessId: string,
    ingredientDtos: MenuItemIngredientDto[],
  ): Promise<{ ingredients: MenuItemIngredient[]; foodCost: number }> {
    const ingredients: MenuItemIngredient[] = [];
    let foodCost = 0;

    for (const dto of ingredientDtos) {
      const invItem = await this.inventoryService.findByIdOrFail(
        businessId,
        dto.inventoryItemId,
      );

      if (!invItem.isActive) {
        throw new BadRequestException(
          `Inventory item "${invItem.name}" is inactive and cannot be linked`,
        );
      }

      const costPerUnit = Number(invItem.costPerUnit);
      ingredients.push({
        inventoryItemId: invItem.id,
        inventoryItemName: invItem.name,
        quantityUsed: dto.quantityUsed,
        unit: dto.unit,
        costPerUnit,
      });

      foodCost += dto.quantityUsed * costPerUnit;
    }

    return { ingredients, foodCost: Math.round(foodCost * 100) / 100 };
  }

  /**
   * Sync the linkedMenuItems reverse-index on inventory items
   */
  private async syncLinkedMenuItems(
    businessId: string,
    menuItemId: string,
    menuItemName: string,
    newIngredients: MenuItemIngredient[],
    oldIngredients: MenuItemIngredient[],
  ): Promise<void> {
    const oldIds = new Set(oldIngredients.map((i) => i.inventoryItemId));
    const newIds = new Set(newIngredients.map((i) => i.inventoryItemId));

    // Remove from inventory items no longer linked
    const removedIds = [...oldIds].filter((id) => !newIds.has(id));
    for (const invId of removedIds) {
      try {
        const invItem = await this.prisma.inventoryItem.findFirst({
          where: { id: invId, restaurantId: businessId },
        });
        if (!invItem) continue;

        const linked = (invItem.linkedMenuItems || []) as unknown as LinkedMenuItem[];
        const filtered = linked.filter((l) => l.menuItemId !== menuItemId);
        await this.prisma.inventoryItem.update({
          where: { id: invId },
          data: { linkedMenuItems: filtered as object[] },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to remove linkedMenuItem from inventory ${invId}: ${err}`,
        );
      }
    }

    // Add/update on currently linked inventory items
    for (const ingredient of newIngredients) {
      try {
        const invItem = await this.prisma.inventoryItem.findFirst({
          where: { id: ingredient.inventoryItemId, restaurantId: businessId },
        });
        if (!invItem) continue;

        const linked = (invItem.linkedMenuItems || []) as unknown as LinkedMenuItem[];
        const filtered = linked.filter((l) => l.menuItemId !== menuItemId);
        filtered.push({
          menuItemId,
          itemName: menuItemName,
          quantityUsed: ingredient.quantityUsed,
          unit: ingredient.unit,
        });
        await this.prisma.inventoryItem.update({
          where: { id: ingredient.inventoryItemId },
          data: { linkedMenuItems: filtered as object[] },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to update linkedMenuItem on inventory ${ingredient.inventoryItemId}: ${err}`,
        );
      }
    }
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
        modifierGroups: [],
        totalCategories: 0,
        totalItems: 0,
        totalModifierGroups: 0,
        menuVersion: 1.0,
        lastPublished: undefined,
      };
    }

    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];
    const modifierGroups = menuData?.modifierGroups || [];

    return {
      categories,
      items,
      modifierGroups,
      totalCategories: categories.length,
      totalItems: items.length,
      totalModifierGroups: modifierGroups.length,
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
          categories: { categories: [], items: [], modifierGroups: [] },
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
    const modifierGroups = menuData?.modifierGroups || [];

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

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });
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
    const modifierGroups = menuData?.modifierGroups || [];

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

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });
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
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];
    const modifierGroups = menuData?.modifierGroups || [];

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

    const filteredCategories = categories.filter((c) => c.id !== categoryId);

    await this.saveMenuData(menuRecord.id, { categories: filteredCategories, items, modifierGroups });
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
    const modifierGroups = menuData?.modifierGroups || [];

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
      modifierGroups,
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
    const modifierGroups = menuData?.modifierGroups || [];

    // Validate category exists
    const categoryExists = categories.some((c) => c.id === dto.categoryId);
    if (!categoryExists) {
      throw new BadRequestException(
        `Category with ID ${dto.categoryId} not found`,
      );
    }

    // Process image (upload to Cloudinary if base64)
    const imageUrl = await this.processImage(dto.image);

    // Resolve ingredients if provided
    let resolvedIngredients: MenuItemIngredient[] | undefined;
    let foodCost: number | undefined;
    if (dto.ingredients?.length) {
      const resolved = await this.resolveIngredients(businessId, dto.ingredients);
      resolvedIngredients = resolved.ingredients;
      foodCost = resolved.foodCost;
    }

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
      ingredients: resolvedIngredients,
      foodCost,
      createdAt: now,
      updatedAt: now,
    };

    items.push(newItem);

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });

    // Sync reverse-index on inventory items
    if (resolvedIngredients?.length) {
      await this.syncLinkedMenuItems(
        businessId,
        newItem.id,
        newItem.name,
        resolvedIngredients,
        [],
      );
    }

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
    const modifierGroups = menuData?.modifierGroups || [];

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

    // Resolve ingredients if provided
    const oldIngredients = items[itemIndex].ingredients || [];
    let resolvedIngredients: MenuItemIngredient[] | undefined;
    let foodCost: number | undefined;
    if (dto.ingredients !== undefined) {
      if (dto.ingredients.length > 0) {
        const resolved = await this.resolveIngredients(businessId, dto.ingredients);
        resolvedIngredients = resolved.ingredients;
        foodCost = resolved.foodCost;
      } else {
        // Explicitly clearing ingredients
        resolvedIngredients = [];
        foodCost = 0;
      }
    }

    const updatedItem: MenuItem = {
      ...items[itemIndex],
      ...dto,
      image: imageUrl,
      ...(resolvedIngredients !== undefined && { ingredients: resolvedIngredients }),
      ...(foodCost !== undefined && { foodCost }),
      updatedAt: new Date().toISOString(),
    };

    items[itemIndex] = updatedItem;

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });

    // Sync reverse-index on inventory items if ingredients changed
    if (resolvedIngredients !== undefined) {
      await this.syncLinkedMenuItems(
        businessId,
        itemId,
        updatedItem.name,
        resolvedIngredients,
        oldIngredients,
      );
    }

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
    const modifierGroups = menuData?.modifierGroups || [];

    const itemIndex = items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }

    const deletedItem = items[itemIndex];

    // Clean up reverse-index on inventory items
    if (deletedItem.ingredients?.length) {
      await this.syncLinkedMenuItems(
        businessId,
        itemId,
        deletedItem.name,
        [],
        deletedItem.ingredients,
      );
    }

    items = items.filter((i) => i.id !== itemId);

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });
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
    const modifierGroups = menuData?.modifierGroups || [];

    const updatedItems: MenuItem[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      if (itemIds.includes(item.id)) {
        item.isAvailable = isAvailable;
        item.updatedAt = now;
        updatedItems.push(item);
      }
    }

    await this.saveMenuData(menuRecord.id, { categories, items, modifierGroups });
    await this.createAuditLog(businessId, userId, 'BULK_UPDATE', 'menu_items', {
      itemIds,
      isAvailable,
    });

    return updatedItems;
  }

  // ==================== MODIFIER GROUP OPERATIONS ====================

  /**
   * Get all modifier groups
   */
  async getModifierGroups(businessId: string): Promise<ModifierGroup[]> {
    const menu = await this.getMenu(businessId);
    return menu.modifierGroups;
  }

  /**
   * Get modifier group by ID
   */
  async getModifierGroupById(
    businessId: string,
    groupId: string,
  ): Promise<ModifierGroup> {
    const menu = await this.getMenu(businessId);
    const group = menu.modifierGroups.find((g) => g.id === groupId);

    if (!group) {
      throw new NotFoundException(
        `Modifier group with ID ${groupId} not found`,
      );
    }

    return group;
  }

  /**
   * Create a new modifier group
   */
  async createModifierGroup(
    businessId: string,
    dto: CreateModifierGroupDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ModifierGroup> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];
    const modifierGroups = menuData?.modifierGroups || [];

    const now = new Date().toISOString();

    const options: ModifierGroupOption[] = dto.options.map((opt, index) => ({
      id: uuidv4(),
      name: opt.name,
      price: opt.price,
      isDefault: opt.isDefault,
      sortOrder: opt.sortOrder ?? index + 1,
    }));

    const newGroup: ModifierGroup = {
      id: uuidv4(),
      name: dto.name,
      required: dto.required ?? false,
      multiSelect: dto.multiSelect ?? false,
      minSelections: dto.minSelections,
      maxSelections: dto.maxSelections,
      options,
      sortOrder: dto.sortOrder ?? modifierGroups.length + 1,
      createdAt: now,
      updatedAt: now,
    };

    modifierGroups.push(newGroup);

    await this.saveMenuData(menuRecord.id, {
      categories,
      items,
      modifierGroups,
    });
    await this.createAuditLog(
      businessId,
      userId,
      'CREATE',
      'modifier_group',
      { groupId: newGroup.id, name: newGroup.name },
      context,
    );

    this.logger.log(
      `Modifier group created: ${newGroup.name} (${newGroup.id}) for business ${businessId}`,
    );
    return newGroup;
  }

  /**
   * Update a modifier group
   */
  async updateModifierGroup(
    businessId: string,
    groupId: string,
    dto: UpdateModifierGroupDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ModifierGroup> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];
    const modifierGroups = menuData?.modifierGroups || [];

    const groupIndex = modifierGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      throw new NotFoundException(
        `Modifier group with ID ${groupId} not found`,
      );
    }

    let options = modifierGroups[groupIndex].options;
    if (dto.options) {
      options = dto.options.map((opt, index) => ({
        id: uuidv4(),
        name: opt.name,
        price: opt.price,
        isDefault: opt.isDefault,
        sortOrder: opt.sortOrder ?? index + 1,
      }));
    }

    const updatedGroup: ModifierGroup = {
      ...modifierGroups[groupIndex],
      ...dto,
      options,
      updatedAt: new Date().toISOString(),
    };

    modifierGroups[groupIndex] = updatedGroup;

    await this.saveMenuData(menuRecord.id, {
      categories,
      items,
      modifierGroups,
    });
    await this.createAuditLog(
      businessId,
      userId,
      'UPDATE',
      'modifier_group',
      { groupId, updatedFields: Object.keys(dto) },
      context,
    );

    return updatedGroup;
  }

  /**
   * Delete a modifier group
   */
  async deleteModifierGroup(
    businessId: string,
    groupId: string,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const menuRecord = await this.getOrCreateMenuRecord(businessId);
    const menuData = menuRecord.categories as unknown as MenuData;
    const categories = menuData?.categories || [];
    const items = menuData?.items || [];
    let modifierGroups = menuData?.modifierGroups || [];

    const groupIndex = modifierGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      throw new NotFoundException(
        `Modifier group with ID ${groupId} not found`,
      );
    }

    modifierGroups = modifierGroups.filter((g) => g.id !== groupId);

    await this.saveMenuData(menuRecord.id, {
      categories,
      items,
      modifierGroups,
    });
    await this.createAuditLog(
      businessId,
      userId,
      'DELETE',
      'modifier_group',
      { groupId },
      context,
    );

    this.logger.log(
      `Modifier group deleted: ${groupId} for business ${businessId}`,
    );
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
