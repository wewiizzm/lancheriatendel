export const DEFAULT_SETTINGS = {
  whatsappNumber: '',
  onlineOrdersPaused: false,
  onlineOpenTime: '19:00',
  onlineCloseTime: '23:00',
};

export const DEFAULT_CATEGORIES = [
  { slug: 'lanches', name: 'Lanches', position: 1 },
  { slug: 'pratos', name: 'Pratos', position: 2 },
  { slug: 'bebidas', name: 'Bebidas', position: 3 },
  { slug: 'sobremesas', name: 'Sobremesas', position: 4 },
];

export const DEFAULT_MENU_ITEMS = [
  {
    categorySlug: 'lanches',
    title: 'X-Burger Artesanal',
    description: 'Pao brioche, hamburguer bovino 160g, queijo cheddar, tomate e molho da casa.',
    priceCents: 2690,
    position: 1,
  },
  {
    categorySlug: 'lanches',
    title: 'X-Bacon Supremo',
    description: 'Pao selado, hamburguer bovino 180g, queijo prato, bacon crocante, cebola caramelizada e molho especial.',
    priceCents: 3190,
    position: 2,
  },
  {
    categorySlug: 'pratos',
    title: 'Parmegiana de Frango',
    description: 'File de frango empanado, molho de tomate artesanal, queijo gratinado, arroz branco e batata frita.',
    priceCents: 4200,
    position: 1,
  },
  {
    categorySlug: 'pratos',
    title: 'Strogonoff de Carne',
    description: 'Tiras de carne, creme de leite, molho especial, arroz branco e batata palha.',
    priceCents: 3850,
    position: 2,
  },
  {
    categorySlug: 'bebidas',
    title: 'Suco Natural 500ml',
    description: 'Fruta natural batida na hora e agua filtrada.',
    priceCents: 1190,
    position: 1,
  },
  {
    categorySlug: 'bebidas',
    title: 'Refrigerante Lata',
    description: 'Bebida gaseificada em lata 350ml (Coca-Cola, Guarana, Sprite ou Fanta).',
    priceCents: 650,
    position: 2,
  },
  {
    categorySlug: 'sobremesas',
    title: 'Brownie com Sorvete',
    description: 'Brownie de chocolate, sorvete de creme e calda de chocolate.',
    priceCents: 1890,
    position: 1,
  },
  {
    categorySlug: 'sobremesas',
    title: 'Pudim da Casa',
    description: 'Leite condensado, ovos, leite e calda de caramelo.',
    priceCents: 1290,
    position: 2,
  },
];
