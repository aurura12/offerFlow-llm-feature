import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      events: {
        orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
  return NextResponse.json(jobs)
}

export async function POST(request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await request.json()
  const { companyName, jobTitle, status, city, salaryRange, workMode, channel, priority, appliedDate, jobLink, jdText, resumeId, contactName, contactInfo, nextAction, notes, endReason, interviewRounds, timeline } = body

  const jobStatus = status || '已投递'
  const jobDate = appliedDate || new Date().toISOString().slice(0, 10)
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: user.id,
        companyName: companyName || '',
        jobTitle: jobTitle || '',
        status: jobStatus,
        city: city || '',
        salaryRange: salaryRange || '',
        workMode: workMode || '',
        channel: channel || '',
        priority: priority || '中',
        appliedDate: appliedDate || '',
        jobLink: jobLink || '',
        jdText: jdText || '',
        resumeId: resumeId || null,
        contactName: contactName || '',
        contactInfo: contactInfo || '',
        nextAction: nextAction || '',
        notes: notes || '',
        endReason: endReason || '',
        interviewRounds: interviewRounds || [],
        timeline: timeline || [],
      },
    })
    const event = await tx.jobEvent.create({
      data: {
        userId: user.id,
        jobId: job.id,
        type: 'CREATED',
        title: '创建投递',
        eventDate: jobDate,
        toStatus: jobStatus,
      },
    })
    return { job, event }
  })

  return NextResponse.json(result, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await request.json()
  const { id, status, ...data } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const existing = await prisma.job.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: '无权修改此记录' }, { status: 403 })
  }

  // Convert empty resumeId to null to avoid FK issues
  if (data.resumeId === '') data.resumeId = null
  // Events are managed through the dedicated event endpoints.
  delete data.events
  delete data.userId

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.update({
      where: { id },
      data: { ...data, ...(status === undefined ? {} : { status }) },
    })

    let event = null
    if (status !== undefined && status !== existing.status) {
      event = await tx.jobEvent.create({
        data: {
          userId: user.id,
          jobId: id,
          type: 'STATUS_CHANGED',
          title: '状态变更',
          eventDate: new Date().toISOString().slice(0, 10),
          fromStatus: existing.status,
          toStatus: status,
        },
      })
    }
    return { job, event }
  })

  return NextResponse.json(result)
}

export async function DELETE(request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  let ids = []
  if (id) {
    ids = [id]
  } else {
    const body = await request.json().catch(() => ({}))
    ids = body.ids || []
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  // Verify ownership for all ids
  const owned = await prisma.job.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: { id: true },
  })
  const ownedIds = owned.map((j) => j.id)

  if (ownedIds.length === 0) {
    return NextResponse.json({ error: '无权删除' }, { status: 403 })
  }

  await prisma.job.deleteMany({
    where: { id: { in: ownedIds } },
  })

  return NextResponse.json({ success: true, deletedIds: ownedIds })
}
