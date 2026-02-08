export interface MenuItemModifier {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
  sortOrder: number;
}

export interface MenuItemModifiers {
  sizes?: MenuItemModifier[];
  spiceLevels?: MenuItemModifier[];
  preparation?: string[];
  addOns?: MenuItemModifier[];
  removals?: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  isAvailable: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  preparationTime?: number;
  sortOrder: number;
  modifiers?: MenuItemModifiers;
  taxCode?: string;
  taxCategory?: string;
  customTaxRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuData {
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface MenuResponse {
  categories: MenuCategory[];
  items: MenuItem[];
  totalCategories: number;
  totalItems: number;
  menuVersion: number;
  lastPublished?: string;
}
