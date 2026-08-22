import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const offers = await prisma.offer.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      job: {
        select: {
          id: true,
          companyName: true,
          jobTitle: true,
          status: true,
          city: true,
          salaryRange: true,
          workMode: true,
          priority: true,
        },
      },
    },
  })

  return NextResponse.json(offers)
}
