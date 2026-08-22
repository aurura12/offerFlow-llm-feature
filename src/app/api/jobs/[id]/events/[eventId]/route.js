import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(request, { params }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id: jobId, eventId } = await params
  const event = await prisma.jobEvent.findFirst({
    where: { id: eventId, jobId, userId: user.id },
  })
  if (!event) return NextResponse.json({ error: '记录不存在或无权访问' }, { status: 404 })
  if (event.type !== 'NOTE') {
    return NextResponse.json({ error: '系统自动记录不可删除' }, { status: 400 })
  }

  await prisma.jobEvent.delete({ where: { id: eventId } })
  return NextResponse.json({ success: true, eventId })
}
