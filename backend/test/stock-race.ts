/**
 * Тест конкурентной покупки последнего товара.
 *
 * Сценарий: у варианта осталось N единиц, 30 «пользователей» одновременно
 * пытаются оформить заказ. Ожидание: резервов создано ровно N, ни единицей
 * больше; остальные получают отказ.
 *
 * Работает напрямую с БД через ту же атомарную операцию, что и
 * InventoryService.reserve. Запуск (нужна поднятая БД с миграциями):
 *   npm run test:stock-race
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STOCK = 3; // столько единиц на складе
const BUYERS = 30; // столько конкурентных покупателей

async function main() {
  // Подготовка: временный товар с ограниченным остатком
  const category = await prisma.category.upsert({
    where: { slug: '__race-test' },
    update: {},
    create: { slug: '__race-test', name: 'race-test' },
  });
  const product = await prisma.product.create({
    data: {
      slug: `__race-test-${Date.now()}`,
      name: 'RACE TEST',
      categoryId: category.id,
      basePrice: 100,
      status: 'PUBLISHED',
      variants: {
        create: [{ sku: `RACE-${Date.now()}`, color: 'test', size: 'M', stockQuantity: STOCK }],
      },
    },
    include: { variants: true },
  });
  const variantId = product.variants[0].id;

  // Атака: BUYERS конкурентных попыток зарезервировать 1 шт.
  const attempts = Array.from({ length: BUYERS }, async () => {
    const updated: number = await prisma.$executeRaw`
      UPDATE product_variants
         SET "reservedQuantity" = "reservedQuantity" + 1
       WHERE id = ${variantId}
         AND status = 'ACTIVE'
         AND "stockQuantity" - "reservedQuantity" >= 1
    `;
    return updated === 1;
  });

  const results = await Promise.all(attempts);
  const succeeded = results.filter(Boolean).length;
  const failed = results.length - succeeded;

  const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });

  console.log(`Остаток на складе:        ${STOCK}`);
  console.log(`Конкурентных покупателей: ${BUYERS}`);
  console.log(`Успешных резервов:        ${succeeded}`);
  console.log(`Отказов:                  ${failed}`);
  console.log(`reservedQuantity в БД:    ${variant.reservedQuantity}`);

  // Очистка
  await prisma.product.delete({ where: { id: product.id } });

  if (succeeded !== STOCK || variant.reservedQuantity !== STOCK) {
    console.error('❌ ПРОВАЛ: зарезервировано больше, чем есть на складе!');
    process.exit(1);
  }
  console.log('✅ OK: продано ровно столько, сколько было на складе. Овер-селлинг невозможен.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
