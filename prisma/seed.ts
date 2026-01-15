import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// High-quality food images from Unsplash (free to use)
const images = {
  categories: {
    appetizers: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&h=300&fit=crop',
    mainCourse: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
    beverages: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
    desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop',
    sides: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
    pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
    burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
    salads: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  },
  items: {
    // Appetizers
    springRolls: 'https://images.unsplash.com/photo-1548507200-dacf6d3a8507?w=400&h=300&fit=crop',
    nachos: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop',
    wings: 'https://images.unsplash.com/photo-1608039829572-d7b49c0b5535?w=400&h=300&fit=crop',
    soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
    bruschetta: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400&h=300&fit=crop',

    // Main Course
    grilledChicken: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop',
    steak: 'https://images.unsplash.com/photo-1546833998-877b37c2e4c6?w=400&h=300&fit=crop',
    salmon: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=300&fit=crop',
    biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop',

    // Burgers
    classicBurger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
    cheeseBurger: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop',
    veggiBurger: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop',

    // Pizza
    margherita: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop',
    pepperoni: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop',
    veggiePizza: 'https://images.unsplash.com/photo-1511689660979-10d2b1aada49?w=400&h=300&fit=crop',

    // Beverages
    coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
    lemonade: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop',
    smoothie: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    icedTea: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=400&h=300&fit=crop',
    milkshake: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop',

    // Desserts
    cheesecake: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400&h=300&fit=crop',
    iceCream: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=300&fit=crop',
    brownie: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop',
    tiramisu: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop',

    // Sides
    fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop',
    onionRings: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop',
    coleslaw: 'https://images.unsplash.com/photo-1625938145744-533e82abccde?w=400&h=300&fit=crop',
    garlicBread: 'https://images.unsplash.com/photo-1619531040576-f9416abb9f1a?w=400&h=300&fit=crop',

    // Salads
    caesarSalad: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop',
    greekSalad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',
    gardenSalad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  },
};

async function seedMenuItems() {
  console.log('🌱 Starting menu item seeding...');

  // Find all restaurants
  const restaurants = await prisma.restaurant.findMany();

  if (restaurants.length === 0) {
    console.log('⚠️  No restaurants found. Please create a restaurant first.');
    return;
  }

  console.log(`📍 Found ${restaurants.length} restaurant(s)`);

  for (const restaurant of restaurants) {
    console.log(`\n🍴 Seeding menu for: ${restaurant.name}`);

    // Check if menu already exists
    const existingMenu = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id },
    });

    if (existingMenu) {
      const menuData = existingMenu.categories as { categories: unknown[]; items: unknown[] };
      if (menuData?.items?.length > 0) {
        console.log(`   ⏭️  Menu already has ${menuData.items.length} items, skipping...`);
        continue;
      }
    }

    const now = new Date().toISOString();

    // Create categories
    const categories = [
      {
        id: uuidv4(),
        name: 'Appetizers',
        description: 'Start your meal with these delicious appetizers',
        image: images.categories.appetizers,
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Burgers',
        description: 'Juicy handcrafted burgers made fresh',
        image: images.categories.burgers,
        sortOrder: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Pizza',
        description: 'Authentic wood-fired pizzas',
        image: images.categories.pizza,
        sortOrder: 3,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Main Course',
        description: 'Hearty main dishes',
        image: images.categories.mainCourse,
        sortOrder: 4,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Salads',
        description: 'Fresh and healthy salads',
        image: images.categories.salads,
        sortOrder: 5,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Sides',
        description: 'Perfect accompaniments',
        image: images.categories.sides,
        sortOrder: 6,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Beverages',
        description: 'Refreshing drinks',
        image: images.categories.beverages,
        sortOrder: 7,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Desserts',
        description: 'Sweet treats to end your meal',
        image: images.categories.desserts,
        sortOrder: 8,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    // Create items
    const items = [
      // Appetizers
      {
        id: uuidv4(),
        name: 'Crispy Spring Rolls',
        description: 'Golden fried vegetable spring rolls served with sweet chili sauce',
        price: 8.99,
        image: images.items.springRolls,
        categoryId: categories[0].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 10,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Loaded Nachos',
        description: 'Tortilla chips with melted cheese, jalapeños, sour cream, and guacamole',
        price: 12.99,
        image: images.items.nachos,
        categoryId: categories[0].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 12,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Buffalo Wings',
        description: 'Crispy chicken wings tossed in spicy buffalo sauce',
        price: 14.99,
        image: images.items.wings,
        categoryId: categories[0].id,
        isAvailable: true,
        preparationTime: 15,
        sortOrder: 3,
        modifiers: {
          spiceLevels: [
            { id: uuidv4(), name: 'Mild', price: 0, sortOrder: 1, isDefault: true },
            { id: uuidv4(), name: 'Medium', price: 0, sortOrder: 2 },
            { id: uuidv4(), name: 'Hot', price: 0, sortOrder: 3 },
            { id: uuidv4(), name: 'Extra Hot', price: 1, sortOrder: 4 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Tomato Basil Soup',
        description: 'Creamy tomato soup with fresh basil and garlic croutons',
        price: 7.99,
        image: images.items.soup,
        categoryId: categories[0].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 8,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Bruschetta',
        description: 'Toasted bread topped with fresh tomatoes, basil, and balsamic glaze',
        price: 9.99,
        image: images.items.bruschetta,
        categoryId: categories[0].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 8,
        sortOrder: 5,
        createdAt: now,
        updatedAt: now,
      },

      // Burgers
      {
        id: uuidv4(),
        name: 'Classic Beef Burger',
        description: '1/3 lb Angus beef patty with lettuce, tomato, onion, and special sauce',
        price: 15.99,
        image: images.items.classicBurger,
        categoryId: categories[1].id,
        isAvailable: true,
        preparationTime: 15,
        sortOrder: 1,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Regular', price: 0, sortOrder: 1, isDefault: true },
            { id: uuidv4(), name: 'Double Patty', price: 5, sortOrder: 2 },
          ],
          addOns: [
            { id: uuidv4(), name: 'Extra Cheese', price: 1.5, sortOrder: 1 },
            { id: uuidv4(), name: 'Bacon', price: 2.5, sortOrder: 2 },
            { id: uuidv4(), name: 'Avocado', price: 2, sortOrder: 3 },
            { id: uuidv4(), name: 'Fried Egg', price: 1.5, sortOrder: 4 },
          ],
          removals: ['Onion', 'Tomato', 'Lettuce', 'Pickles', 'Special Sauce'],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Bacon Cheese Burger',
        description: 'Beef patty with crispy bacon, cheddar cheese, and BBQ sauce',
        price: 17.99,
        image: images.items.cheeseBurger,
        categoryId: categories[1].id,
        isAvailable: true,
        preparationTime: 15,
        sortOrder: 2,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Regular', price: 0, sortOrder: 1, isDefault: true },
            { id: uuidv4(), name: 'Double Patty', price: 5, sortOrder: 2 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Garden Veggie Burger',
        description: 'House-made veggie patty with avocado, sprouts, and chipotle mayo',
        price: 14.99,
        image: images.items.veggiBurger,
        categoryId: categories[1].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 15,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },

      // Pizza
      {
        id: uuidv4(),
        name: 'Margherita Pizza',
        description: 'Classic pizza with fresh mozzarella, tomato sauce, and basil',
        price: 16.99,
        image: images.items.margherita,
        categoryId: categories[2].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 20,
        sortOrder: 1,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Small (10")', price: 0, sortOrder: 1 },
            { id: uuidv4(), name: 'Medium (12")', price: 3, sortOrder: 2, isDefault: true },
            { id: uuidv4(), name: 'Large (14")', price: 6, sortOrder: 3 },
          ],
          addOns: [
            { id: uuidv4(), name: 'Extra Cheese', price: 2, sortOrder: 1 },
            { id: uuidv4(), name: 'Mushrooms', price: 1.5, sortOrder: 2 },
            { id: uuidv4(), name: 'Olives', price: 1.5, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Pepperoni Pizza',
        description: 'Loaded with pepperoni slices and melted mozzarella',
        price: 18.99,
        image: images.items.pepperoni,
        categoryId: categories[2].id,
        isAvailable: true,
        preparationTime: 20,
        sortOrder: 2,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Small (10")', price: 0, sortOrder: 1 },
            { id: uuidv4(), name: 'Medium (12")', price: 3, sortOrder: 2, isDefault: true },
            { id: uuidv4(), name: 'Large (14")', price: 6, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Garden Veggie Pizza',
        description: 'Bell peppers, mushrooms, onions, olives, and fresh tomatoes',
        price: 17.99,
        image: images.items.veggiePizza,
        categoryId: categories[2].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 20,
        sortOrder: 3,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Small (10")', price: 0, sortOrder: 1 },
            { id: uuidv4(), name: 'Medium (12")', price: 3, sortOrder: 2, isDefault: true },
            { id: uuidv4(), name: 'Large (14")', price: 6, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },

      // Main Course
      {
        id: uuidv4(),
        name: 'Grilled Chicken Breast',
        description: 'Herb-marinated chicken breast with roasted vegetables and mashed potatoes',
        price: 19.99,
        image: images.items.grilledChicken,
        categoryId: categories[3].id,
        isAvailable: true,
        isGlutenFree: true,
        preparationTime: 25,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Ribeye Steak',
        description: '12oz USDA Prime ribeye cooked to perfection with garlic butter',
        price: 34.99,
        image: images.items.steak,
        categoryId: categories[3].id,
        isAvailable: true,
        isGlutenFree: true,
        preparationTime: 30,
        sortOrder: 2,
        modifiers: {
          preparation: ['Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Pan-Seared Salmon',
        description: 'Fresh Atlantic salmon with lemon dill sauce and asparagus',
        price: 26.99,
        image: images.items.salmon,
        categoryId: categories[3].id,
        isAvailable: true,
        isGlutenFree: true,
        preparationTime: 20,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Fettuccine Alfredo',
        description: 'Creamy parmesan sauce with fettuccine pasta and grilled chicken',
        price: 18.99,
        image: images.items.pasta,
        categoryId: categories[3].id,
        isAvailable: true,
        preparationTime: 18,
        sortOrder: 4,
        modifiers: {
          addOns: [
            { id: uuidv4(), name: 'Grilled Shrimp', price: 6, sortOrder: 1 },
            { id: uuidv4(), name: 'Extra Chicken', price: 4, sortOrder: 2 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Chicken Biryani',
        description: 'Fragrant basmati rice with tender chicken and aromatic spices',
        price: 17.99,
        image: images.items.biryani,
        categoryId: categories[3].id,
        isAvailable: true,
        isGlutenFree: true,
        preparationTime: 25,
        sortOrder: 5,
        modifiers: {
          spiceLevels: [
            { id: uuidv4(), name: 'Mild', price: 0, sortOrder: 1 },
            { id: uuidv4(), name: 'Medium', price: 0, sortOrder: 2, isDefault: true },
            { id: uuidv4(), name: 'Spicy', price: 0, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },

      // Salads
      {
        id: uuidv4(),
        name: 'Caesar Salad',
        description: 'Romaine lettuce with parmesan, croutons, and Caesar dressing',
        price: 12.99,
        image: images.items.caesarSalad,
        categoryId: categories[4].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 8,
        sortOrder: 1,
        modifiers: {
          addOns: [
            { id: uuidv4(), name: 'Grilled Chicken', price: 4, sortOrder: 1 },
            { id: uuidv4(), name: 'Grilled Shrimp', price: 6, sortOrder: 2 },
            { id: uuidv4(), name: 'Salmon', price: 7, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Greek Salad',
        description: 'Cucumbers, tomatoes, olives, feta cheese with olive oil dressing',
        price: 11.99,
        image: images.items.greekSalad,
        categoryId: categories[4].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 8,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Garden Salad',
        description: 'Mixed greens with seasonal vegetables and house vinaigrette',
        price: 9.99,
        image: images.items.gardenSalad,
        categoryId: categories[4].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        preparationTime: 6,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },

      // Sides
      {
        id: uuidv4(),
        name: 'French Fries',
        description: 'Crispy golden fries with sea salt',
        price: 5.99,
        image: images.items.fries,
        categoryId: categories[5].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 8,
        sortOrder: 1,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Regular', price: 0, sortOrder: 1, isDefault: true },
            { id: uuidv4(), name: 'Large', price: 2, sortOrder: 2 },
          ],
          addOns: [
            { id: uuidv4(), name: 'Cheese Sauce', price: 1.5, sortOrder: 1 },
            { id: uuidv4(), name: 'Truffle Oil', price: 2, sortOrder: 2 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Onion Rings',
        description: 'Beer-battered onion rings with spicy aioli',
        price: 7.99,
        image: images.items.onionRings,
        categoryId: categories[5].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 10,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Coleslaw',
        description: 'Creamy coleslaw with cabbage and carrots',
        price: 4.99,
        image: images.items.coleslaw,
        categoryId: categories[5].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 2,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter and herbs',
        price: 5.99,
        image: images.items.garlicBread,
        categoryId: categories[5].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 5,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },

      // Beverages
      {
        id: uuidv4(),
        name: 'Fresh Coffee',
        description: 'Freshly brewed premium coffee',
        price: 3.99,
        image: images.items.coffee,
        categoryId: categories[6].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        preparationTime: 3,
        sortOrder: 1,
        modifiers: {
          sizes: [
            { id: uuidv4(), name: 'Small', price: 0, sortOrder: 1 },
            { id: uuidv4(), name: 'Medium', price: 1, sortOrder: 2, isDefault: true },
            { id: uuidv4(), name: 'Large', price: 2, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Fresh Lemonade',
        description: 'House-made lemonade with fresh lemons and mint',
        price: 4.99,
        image: images.items.lemonade,
        categoryId: categories[6].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        preparationTime: 3,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Berry Smoothie',
        description: 'Mixed berries blended with yogurt and honey',
        price: 6.99,
        image: images.items.smoothie,
        categoryId: categories[6].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 5,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Iced Tea',
        description: 'Refreshing iced tea with lemon',
        price: 3.49,
        image: images.items.icedTea,
        categoryId: categories[6].id,
        isAvailable: true,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        preparationTime: 2,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Chocolate Milkshake',
        description: 'Rich chocolate milkshake topped with whipped cream',
        price: 6.99,
        image: images.items.milkshake,
        categoryId: categories[6].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 5,
        sortOrder: 5,
        createdAt: now,
        updatedAt: now,
      },

      // Desserts
      {
        id: uuidv4(),
        name: 'New York Cheesecake',
        description: 'Classic creamy cheesecake with graham cracker crust',
        price: 8.99,
        image: images.items.cheesecake,
        categoryId: categories[7].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 2,
        sortOrder: 1,
        modifiers: {
          addOns: [
            { id: uuidv4(), name: 'Strawberry Topping', price: 1.5, sortOrder: 1 },
            { id: uuidv4(), name: 'Chocolate Sauce', price: 1.5, sortOrder: 2 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Vanilla Ice Cream',
        description: 'Three scoops of premium vanilla ice cream',
        price: 6.99,
        image: images.items.iceCream,
        categoryId: categories[7].id,
        isAvailable: true,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 2,
        sortOrder: 2,
        modifiers: {
          addOns: [
            { id: uuidv4(), name: 'Hot Fudge', price: 1.5, sortOrder: 1 },
            { id: uuidv4(), name: 'Whipped Cream', price: 1, sortOrder: 2 },
            { id: uuidv4(), name: 'Sprinkles', price: 0.5, sortOrder: 3 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Chocolate Brownie',
        description: 'Warm chocolate brownie with vanilla ice cream',
        price: 7.99,
        image: images.items.brownie,
        categoryId: categories[7].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 5,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Tiramisu',
        description: 'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone',
        price: 9.99,
        image: images.items.tiramisu,
        categoryId: categories[7].id,
        isAvailable: true,
        isVegetarian: true,
        preparationTime: 2,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];

    // Upsert the menu
    if (existingMenu) {
      await prisma.menuItem.update({
        where: { id: existingMenu.id },
        data: {
          categories: { categories, items },
          menuVersion: 1.0,
          lastPublished: new Date(),
        },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categories: { categories, items },
          menuVersion: 1.0,
          lastPublished: new Date(),
        },
      });
    }

    console.log(`   ✅ Seeded ${categories.length} categories and ${items.length} menu items`);
  }

  console.log('\n🎉 Menu seeding completed!');
}

async function main() {
  try {
    await seedMenuItems();
  } catch (error) {
    console.error('❌ Error seeding menu items:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
