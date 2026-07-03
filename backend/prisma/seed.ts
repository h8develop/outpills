/**
 * Seed: категории, способы доставки, админ, первая капсульная коллекция
 * из бренд-бука (этап 7 «Силуэты и посадка»). Цены — в копейках.
 * Запуск: npm run prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CHERNY = { color: 'чёрный-винил', colorHex: '#0A0C12' };
const NAVY = { color: 'нэйви', colorHex: '#051655' };
const STEEL = { color: 'сталь', colorHex: '#7A83A1' };

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

function variants(skuPrefix: string, colors: Array<{ color: string; colorHex: string }>, stock = 5) {
  return colors.flatMap((c, ci) =>
    SIZES.map((size, si) => ({
      sku: `${skuPrefix}-${ci + 1}${size}`,
      size,
      ...c,
      stockQuantity: stock,
    })),
  );
}

async function main() {
  // ── Админ (пароль только для dev; в проде сменить сразу) ──
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@outpills.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'outpills-admin-dev';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      firstName: 'Админ',
    },
  });

  // ── Доставка ──
  for (const method of [
    { code: 'cdek', name: 'СДЭК (пункт выдачи)', price: 35000 },
    { code: 'post', name: 'Почта России', price: 30000 },
    { code: 'courier', name: 'Курьер (Москва/СПб)', price: 50000 },
  ]) {
    await prisma.deliveryMethod.upsert({
      where: { code: method.code },
      update: {},
      create: method,
    });
  }

  // ── Категории ──
  const cats: Record<string, string> = {};
  for (const [i, cat] of [
    { slug: 'tees', name: 'Футболки и лонгсливы' },
    { slug: 'hoodies', name: 'Худи и свитшоты' },
    { slug: 'outerwear', name: 'Верхняя одежда' },
    { slug: 'bottoms', name: 'Джинсы и брюки' },
    { slug: 'women', name: 'Женская линия' },
  ].entries()) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, sortOrder: i },
    });
    cats[cat.slug] = c.id;
  }

  // ── Первая капсульная коллекция (из бренд-бука, этап 7) ──
  const products = [
    {
      slug: 'oversize-tee-baza',
      name: 'Oversize tee «БАЗА»',
      categoryId: cats['tees'],
      collection: 'PROTOCOL 01',
      basePrice: 390000,
      shortDescription: 'Боксовая футболка, плечо спущено на 7–8 см. Джерси 240 г/м².',
      description:
        'Базовая доза. Боксовый крой, усиленный ворот 2 см, двойная отстрочка низа, вшивной ярлык-«рецепт» сбоку. Плотный хлопок 240–280 г/м², сухая рука, чистый чёрный. Принт: «этикетка» мелко на груди + «вывеска» на спине.',
      material: 'хлопок компакт-пенье 240 г/м²',
      seoTitle: 'Oversize футболка БАЗА — outpills',
      seoDescription: 'Боксовая oversize-футболка из плотного джерси. Чёрный-винил, нэйви, сталь.',
      colors: [CHERNY, NAVY, STEEL],
      sku: 'OP-TEE-BAZA',
    },
    {
      slug: 'zip-hoodie-protokol',
      name: 'Zip-худи «ПРОТОКОЛ»',
      categoryId: cats['hoodies'],
      collection: 'PROTOCOL 01',
      basePrice: 890000,
      salePrice: 790000,
      shortDescription: 'Oversize зип-худи, футер 380+, капюшон-«шлем» с высокой стойкой.',
      description:
        'Молния до конца стойки — застёгнутый капюшон закрывает пол-лица. Пуллер-капсула, reflective-кант капюшона, крест-патч на рукаве. Вышивка V1 слева на груди, номер партии на спине под воротом.',
      material: 'футер 3-нитка с начёсом 380 г/м²',
      seoTitle: 'Zip-худи ПРОТОКОЛ — outpills',
      seoDescription: 'Тяжёлый oversize зип-худи с капюшоном-шлемом. Пуллеры-капсулы, reflective-кант.',
      colors: [CHERNY, NAVY],
      sku: 'OP-HOOD-PROT',
    },
    {
      slug: 'longsleeve-mesh',
      name: 'Лонгслив mesh',
      categoryId: cats['tees'],
      collection: 'PROTOCOL 01',
      basePrice: 340000,
      shortDescription: 'Облегающий первый слой, рукав до костяшек с отверстием под большой палец.',
      description:
        'Операционная марля как первый слой. Плоские швы, микротекст-инструкция по рукаву, пиктограммы дозировки цепочкой. Мелкий V1 на воротнике сзади. Носить под БАЗУ и худи — сетка торчит из-под рукавов.',
      material: 'mesh, двойной слой, матовое волокно',
      colors: [CHERNY, STEEL],
      sku: 'OP-LONG-MESH',
    },
    {
      slug: 'bomber-nylon',
      name: 'Бомбер нейлон',
      categoryId: cats['outerwear'],
      collection: 'PROTOCOL 01',
      basePrice: 1490000,
      shortDescription: 'Боксовый бомбер из глянцевого нейлона с прозрачным окном-«рецептом» на рукаве.',
      description:
        'Главный «глянец на матовом»: стерильный блеск пакета из аптеки. Матовый подклад-mesh, карман на рукаве с прозрачным окном. Кнопки-кресты, металлический шильд V3 на груди, V2-принт на спине.',
      material: 'глянцевый нейлон 290T+, подклад mesh',
      colors: [CHERNY],
      sku: 'OP-BOMB-NYL',
    },
    {
      slug: 'baggy-jeans',
      name: 'Багги-джинсы',
      categoryId: cats['bottoms'],
      collection: 'PROTOCOL 01',
      basePrice: 990000,
      shortDescription: 'Средняя талия, широченная прямая штанина, холодный washed-деним 13 oz.',
      description:
        'Ледяная вымывка без жёлтизны — «рентген» ткани. Контрастная строчка-риска по внешнему шву, кожаный ярлык-«этикетка», штрихкод у кармана, гравировка на заклёпках.',
      material: 'деним 13 oz, холодный washed',
      colors: [{ color: 'ледяная вымывка', colorHex: '#7C93D4' }, CHERNY],
      sku: 'OP-JEAN-BAG',
    },
    {
      slug: 'baby-tee',
      name: 'Baby tee',
      categoryId: cats['women'],
      gender: 'FEMALE' as const,
      collection: 'PROTOCOL 01',
      basePrice: 320000,
      shortDescription: 'Укороченная облегающая футболка, рукав-крылышко. Главная женская вещь дропа.',
      description:
        'Y2K-канон. Стрейч-хлопок 200+, кант рибаны перивинкл, V3-хром мелко по центру груди (DTF), «этикетка» с дозировкой под лого. Носить с багги/карго на контрасте объёмов.',
      material: 'стрейч-хлопок 200 г/м²',
      colors: [CHERNY, STEEL],
      sku: 'OP-BTEE',
    },
    {
      slug: 'cargo-low-rise',
      name: 'Карго низкая посадка',
      categoryId: cats['bottoms'],
      collection: 'PROTOCOL 01',
      basePrice: 940000,
      shortDescription: 'Low-rise карго с накладным карманом-«аптечкой» на бедре.',
      description:
        'Широкая штанина, стропы-утяжки снизу, 6 карманов. Металлический карабин для жетона, reflective-петли, пиктограммы на клапанах, штамп внутри пояса.',
      material: 'рипстоп / плотный хлопок',
      colors: [CHERNY, NAVY],
      sku: 'OP-CARG-LOW',
    },
    {
      slug: 'tank-ribana',
      name: 'Танк рибана',
      categoryId: cats['tees'],
      collection: 'PROTOCOL 01',
      basePrice: 240000,
      shortDescription: 'Танк по фигуре из жёсткой рибаны 2×2 с вышивкой креста 12 мм.',
      description:
        'Первый слой лета. Узкая круглая горловина, кант перивинкл по проймам, вышивка знака ✚ по центру груди. Чистая вещь — без принтов.',
      material: 'рибана 2×2 с лайкрой 5%',
      colors: [CHERNY, STEEL, NAVY],
      sku: 'OP-TANK-RIB',
    },
  ];

  for (const p of products) {
    const { colors, sku, ...data } = p;
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        ...data,
        status: 'PUBLISHED',
        variants: { create: variants(sku, colors) },
      },
    });
  }

  console.log('Seed выполнен: категории, доставка, админ, коллекция PROTOCOL 01');
  console.log(`Админ: ${adminEmail} / ${adminPassword} (сменить в проде!)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
