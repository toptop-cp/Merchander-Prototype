/*
 * Merchander – business configuration and seed data (Sprint 1).
 *
 * Contact details, address and hours below are PLACEHOLDERS. Replace them with
 * the confirmed details from Golden Legacy General Merchandise before release.
 */
window.MERCHANDER_CONFIG = {
  business: {
    name: 'Golden Legacy General Merchandise',
    shortName: 'Golden Legacy',
    tagline: 'Your trusted beverage wholesaler in Caloocan City',
    overview:
      'Golden Legacy General Merchandise is a family-owned beverage wholesaler in Caloocan City. ' +
      'For decades we have supplied soft drinks, beer, and other alcoholic beverages by the case and ' +
      'half-case to sari-sari stores, mini groceries, and small retailers.',
    address: 'Caloocan City, Metro Manila, Philippines', // TODO: full street address
    phone: '(02) 8000 0000', // TODO: confirm landline
    mobile: '0917 000 0000', // TODO: confirm mobile / Viber
    email: 'goldenlegacy@example.com', // TODO: confirm email
    hours: [
      // TODO: confirm operating hours with the owner
      { days: 'Monday – Saturday', time: '7:00 AM – 6:00 PM' },
      { days: 'Sunday & holidays', time: 'Closed' },
    ],
  },

  security: {
    otpLength: 6,
    otpTtlSeconds: 300, // one-time codes expire after 5 minutes
    otpResendWaitSeconds: 60, // waiting period before a new code can be requested
    otpMaxTries: 5,
    maxLoginAttempts: 5, // failed attempts before a temporary lock
    lockMinutes: 15,
  },

  // Stock at or below this many cases is shown as "Low Stock".
  lowStockCases: 10,

  categories: [
    { id: 'softdrinks', name: 'Soft Drinks', icon: 'bottle' },
    { id: 'beer', name: 'Beer', icon: 'can' },
    { id: 'spirits', name: 'Other Alcoholic Beverages', icon: 'liquor' },
  ],

  // Prices are per case / half-case (PHP). Stock is counted in cases.
  products: [
    { id: 'P001', name: 'Coca-Cola 1.5L', category: 'softdrinks', shape: 'bottle', color: '#d62828', packSize: '12 bottles per case', description: 'Classic Coca-Cola in 1.5-litre PET bottles.', priceCase: 840, priceHalf: 430, stock: 64 },
    { id: 'P002', name: 'Coca-Cola Mismo 290ml', category: 'softdrinks', shape: 'bottle', color: '#b91c1c', packSize: '24 bottles per case', description: 'Single-serve Coca-Cola, popular for sari-sari store resale.', priceCase: 408, priceHalf: 210, stock: 8 },
    { id: 'P003', name: 'Royal Tru-Orange 1.5L', category: 'softdrinks', shape: 'bottle', color: '#f97316', packSize: '12 bottles per case', description: 'Orange-flavoured soft drink in 1.5-litre PET bottles.', priceCase: 720, priceHalf: 370, stock: 40 },
    { id: 'P004', name: 'Sprite 1.5L', category: 'softdrinks', shape: 'bottle', color: '#16a34a', packSize: '12 bottles per case', description: 'Lemon-lime soft drink in 1.5-litre PET bottles.', priceCase: 720, priceHalf: 370, stock: 35 },
    { id: 'P005', name: 'Pepsi 1.5L', category: 'softdrinks', shape: 'bottle', color: '#1d4ed8', packSize: '12 bottles per case', description: 'Pepsi cola in 1.5-litre PET bottles.', priceCase: 720, priceHalf: 370, stock: 0 },
    { id: 'P006', name: 'Mountain Dew 1.5L', category: 'softdrinks', shape: 'bottle', color: '#65a30d', packSize: '12 bottles per case', description: 'Citrus soft drink in 1.5-litre PET bottles.', priceCase: 720, priceHalf: 370, stock: 22 },
    { id: 'P007', name: 'San Miguel Pale Pilsen 320ml', category: 'beer', shape: 'glass', color: '#a16207', packSize: '24 bottles per case', description: 'The original Filipino pale pilsen in returnable glass bottles.', priceCase: 1150, priceHalf: 590, stock: 51 },
    { id: 'P008', name: 'San Mig Light 330ml', category: 'beer', shape: 'can', color: '#0369a1', packSize: '24 cans per case', description: 'Light beer in 330ml cans.', priceCase: 1390, priceHalf: 710, stock: 27 },
    { id: 'P009', name: 'Red Horse Beer 500ml', category: 'beer', shape: 'glass', color: '#991b1b', packSize: '12 bottles per case', description: 'Extra-strong beer in 500ml glass bottles.', priceCase: 780, priceHalf: 400, stock: 6 },
    { id: 'P010', name: 'Red Horse Beer 330ml Can', category: 'beer', shape: 'can', color: '#7f1d1d', packSize: '24 cans per case', description: 'Extra-strong beer in 330ml cans.', priceCase: 1420, priceHalf: 725, stock: 18 },
    { id: 'P011', name: 'Ginebra San Miguel 350ml', category: 'spirits', shape: 'liquor', color: '#0f766e', packSize: '24 bottles per case', description: 'Gin in 350ml flat bottles.', priceCase: 1560, priceHalf: 795, stock: 14 },
    { id: 'P012', name: 'Emperador Light 750ml', category: 'spirits', shape: 'liquor', color: '#92400e', packSize: '12 bottles per case', description: 'Brandy in 750ml bottles.', priceCase: 1980, priceHalf: 1010, stock: 0 },
  ],

  // Demo accounts, one per role. Passwords are hashed when first seeded.
  seedUsers: [
    { role: 'owner', email: 'owner@goldenlegacy.test', mobile: '09170000001', password: 'Owner@2026', firstName: 'Maria', lastName: 'Santos', googleLinked: true },
    { role: 'employee', email: 'staff@goldenlegacy.test', mobile: '09170000002', password: 'Staff@2026', firstName: 'Paolo', lastName: 'Reyes' },
    { role: 'delivery', email: 'driver@goldenlegacy.test', mobile: '09170000003', password: 'Driver@2026', firstName: 'Ramon', lastName: 'Cruz' },
    { role: 'customer', email: 'juan@store.test', mobile: '09171234567', password: 'Customer@2026', firstName: 'Juan', lastName: 'Dela Cruz', businessName: 'Juan Sari-Sari Store', address: { line: '123 Rizal St.', barangay: 'Barangay 12', city: 'Caloocan City', province: 'Metro Manila', postal: '1400' }, googleLinked: true },
    { role: 'customer', email: 'inactive@store.test', mobile: '09171112222', password: 'Customer@2026', firstName: 'Ana', lastName: 'Lim', businessName: 'Ana Mini Grocery', status: 'inactive', address: { line: '45 Mabini St.', barangay: 'Barangay 88', city: 'Caloocan City', province: 'Metro Manila', postal: '1400' } },
  ],
};
