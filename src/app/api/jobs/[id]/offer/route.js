import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { parseOfferInput } from '@/lib/offerComparison'

async function getOwnedJob(jobId, userId) {
  return prisma.job.findFirst({ where: { id: jobId, userId } })
}

export async function PUT(request, { params }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id: jobId } = await params
  const job = await getOwnedJob(jobId, user.id)
  if (!job) return NextResponse.json({ error: '岗位不存在或无权访问' }, { status: 404 })

  const parsed = parseOfferInput(await request.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const offer = await prisma.offer.upsert({
    where: { jobId },
    create: { ...parsed.data, userId: user.id, jobId },
    update: { ...parsed.data },
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

  return NextResponse.json(offer)
}

export async function DELETE(request, { params }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id: jobId } = await params
  const job = await getOwnedJob(jobId, user.id)
  if (!job) return NextResponse.json({ error: '岗位不存在或无权访问' }, { status: 404 })

  await prisma.offer.deleteMany({ where: { jobId, userId: user.id } })
  return NextResponse.json({ success: true })
}
