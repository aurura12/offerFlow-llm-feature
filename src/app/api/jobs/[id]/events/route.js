import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(request, { params }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id: jobId } = await params
  const job = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
  if (!job) return NextResponse.json({ error: '岗位不存在或无权访问' }, { status: 404 })

  const body = await request.json()
  const title = (body.title || '').trim()
  const eventDate = (body.eventDate || '').trim()
  const notes = (body.notes || '').trim()
  if (!title || !eventDate) {
    return NextResponse.json({ error: '请填写记录标题和日期' }, { status: 400 })
  }

  const event = await prisma.jobEvent.create({
    data: {
      userId: user.id,
      jobId,
      type: 'NOTE',
      title,
      eventDate,
      notes: notes || null,
    },
  })
  return NextResponse.json({ event }, { status: 201 })
}
