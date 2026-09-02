import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const persons = await prisma.person.findMany({
      where: { userId: user.id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        agreements: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { name: 'asc' },
    });

    const birthdays = await prisma.birthday.findMany({
      where: { userId: user.id },
      orderBy: { birthDate: 'asc' },
    });

    return NextResponse.json({ persons, birthdays });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, personId, name, role, note, agreementTitle, personName, birthDateIso, relationship } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (target === 'PERSON' && name) {
      const person = await prisma.person.create({
        data: {
          userId: user.id,
          name,
          role: role || 'Contacto',
          notes: note ? { create: { content: note } } : undefined,
        },
      });
      return NextResponse.json({ success: true, person });
    }

    if (target === 'ADD_NOTE' && personId && note) {
      const createdNote = await prisma.personNote.create({
        data: {
          personId,
          content: note,
        },
      });
      return NextResponse.json({ success: true, note: createdNote });
    }

    if (target === 'ADD_AGREEMENT' && personId && agreementTitle) {
      const agreement = await prisma.agreement.create({
        data: {
          personId,
          title: agreementTitle,
          status: 'ACTIVO',
        },
      });
      return NextResponse.json({ success: true, agreement });
    }

    if (target === 'BIRTHDAY' && personName && birthDateIso) {
      const bday = await prisma.birthday.create({
        data: {
          userId: user.id,
          personName,
          birthDate: new Date(birthDateIso),
          relationship: relationship || 'Amigo',
        },
      });
      return NextResponse.json({ success: true, birthday: bday });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
