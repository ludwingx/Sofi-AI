import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌸 Sembrando datos maestros Multi-Tenant para Sofi AI...');

  // 1. Crear o encontrar Usuario Principal (Ludwing)
  const telegramId = process.env.TELEGRAM_ALLOWED_USER_ID || 'ludwing_master';

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ telegramId }, { role: 'ADMIN' }],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Ludwing Armijo',
        telegramId,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`👤 Usuario Admin creado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegramId})`);
  } else {
    console.log(`👤 Usuario encontrado: ${user.name} (ID: ${user.id})`);
  }

  // 2. Contexto Personal
  await prisma.personalContext.upsert({
    where: {
      userId_key: {
        userId: user.id,
        key: 'profile',
      },
    },
    update: {},
    create: {
      userId: user.id,
      key: 'profile',
      data: JSON.stringify({
        name: 'Ludwing Armijo',
        age: 25,
        location: 'Santa Cruz de la Sierra, Bolivia',
        role: 'Desarrollador Full-Stack & Socio 10% OtherBrain',
        monthlySalaryBs: 3300.0,
        fortnightSalaryBs: 1650.0,
        fixedCosts: {
          rentBs: 900.0,
          servicesWifiBs: 150.0,
          foodMarketBs: 800.0,
          transportBs: 150.0,
        },
        roomies: ['Ramón', 'Rocío', 'Molly'],
      }),
    },
  });

  // 3. Deuda Activa Única con Maycol
  const maycolDebt = await prisma.debtCommitment.findFirst({
    where: { userId: user.id, creditorName: 'Maycol' },
  });

  if (!maycolDebt) {
    await prisma.debtCommitment.create({
      data: {
        userId: user.id,
        creditorName: 'Maycol',
        totalAmountBs: 1500.0,
        remainingAmountBs: 1500.0,
        installmentBs: 250.0,
        notes: 'Deuda única consolidada con Maycol. Amortización: 250 Bs quincenales.',
        status: 'ACTIVA',
      },
    });
  }

  // 4. Contactos Clave
  const roomieContacts = [
    { name: 'Maycol', role: 'Socio Fundador OtherBrain', note: 'Socio principal y acreedor de la deuda de 1,500 Bs.' },
    { name: 'Ramón', role: 'Roomie & Colega Dev', note: 'Compañero de departamento y desarrollador.' },
    { name: 'Rocío', role: 'Roomie', note: 'Compañera de departamento.' },
    { name: 'Molly', role: 'Roomie', note: 'Compañera de departamento.' },
  ];

  for (const c of roomieContacts) {
    const existing = await prisma.person.findFirst({ where: { userId: user.id, name: c.name } });
    if (!existing) {
      await prisma.person.create({
        data: {
          userId: user.id,
          name: c.name,
          role: c.role,
          notes: { create: { content: c.note } },
        },
      });
    }
  }

  // 5. Insumos Base de Despensa
  const pantryItems = [
    { name: 'Yerba Mate', currentStock: 500, unit: 'g', defaultPortion: 35, minThreshold: 105, estimatedPriceBs: 18.0 },
    { name: 'Huevos Frescos', currentStock: 30, unit: 'unidades', defaultPortion: 2, minThreshold: 6, estimatedPriceBs: 28.0 },
    { name: 'Café Molido', currentStock: 200, unit: 'g', defaultPortion: 10, minThreshold: 40, estimatedPriceBs: 22.0 },
    { name: 'Avena en Hojuelas', currentStock: 500, unit: 'g', defaultPortion: 50, minThreshold: 100, estimatedPriceBs: 8.0 },
    { name: 'Pechuga de Pollo', currentStock: 2000, unit: 'g', defaultPortion: 250, minThreshold: 500, estimatedPriceBs: 70.0 },
    { name: 'Arroz Blanco', currentStock: 1000, unit: 'g', defaultPortion: 150, minThreshold: 200, estimatedPriceBs: 9.0 },
  ];

  for (const item of pantryItems) {
    await prisma.pantryItem.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: item.name,
        },
      },
      update: {},
      create: {
        userId: user.id,
        ...item,
      },
    });
  }

  // 6. Bloques de Rutina
  const scheduleBlocks = [
    { name: 'Despertar & Desayuno', startTime: '07:00', endTime: '08:30', daysOfWeek: '1,2,3,4,5', description: 'Desayuno nutritivo, mate, preparación' },
    { name: 'Laboral 1 (OtherBrain)', startTime: '08:30', endTime: '13:00', daysOfWeek: '1,2,3,4,5', description: 'Desarrollo de software y tareas prioritarias' },
    { name: 'Almuerzo & Pausa', startTime: '13:00', endTime: '14:30', daysOfWeek: '1,2,3,4,5', description: 'Cocinar en casa, desconexión' },
    { name: 'Laboral 2 (OtherBrain)', startTime: '14:30', endTime: '18:30', daysOfWeek: '1,2,3,4,5', description: 'Bots, soporte, entregables' },
    { name: 'Transición & Cena', startTime: '18:30', endTime: '19:30', daysOfWeek: '1,2,3,4,5', description: 'Cena ligera, despeje' },
    { name: '🔥 Bloque de Poder', startTime: '19:30', endTime: '21:45', daysOfWeek: '1,2,3,4,5', description: 'Sofi AI, proyectos propios' },
    { name: 'Cierre del Día', startTime: '21:45', endTime: '23:30', daysOfWeek: '1,2,3,4,5', description: 'Bitácora, curiosidad tech, relax' },
  ];

  for (const block of scheduleBlocks) {
    const existing = await prisma.scheduleBlock.findFirst({ where: { userId: user.id, name: block.name } });
    if (!existing) {
      await prisma.scheduleBlock.create({
        data: {
          userId: user.id,
          ...block,
        },
      });
    }
  }

  // 7. Estado Inicial de Sofi
  await prisma.sofiMoodState.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      patience: 100,
      affection: 90,
      concern: 20,
      energy: 100,
      cleanStreakDays: 0,
    },
  });

  console.log('✅ Sembrado multi-tenant completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
