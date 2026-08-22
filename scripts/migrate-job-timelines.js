/**
 * 把旧 Job.timeline JSON 转成可查询的 JobEvent。
 *
 * 事件 id 使用 legacy-{jobId}-{index}，因此重复运行是幂等的。
 */
import { PrismaClient } from '@prisma/client'
import { legacyTimelineToEvents } from '../src/lib/jobTimeline.js'

const prisma = new PrismaClient()

try {
  const jobs = await prisma.job.findMany({
    select: { id: true, userId: true, timeline: true },
  })

  let migrated = 0
  for (const job of jobs) {
    const events = legacyTimelineToEvents(job)
    for (const event of events) {
      await prisma.jobEvent.upsert({
        where: { id: event.id },
        update: {},
        create: {
          id: event.id,
          userId: event.userId,
          jobId: event.jobId,
          type: event.type,
          title: event.title,
          eventDate: event.eventDate || new Date().toISOString().slice(0, 10),
          notes: event.notes,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          createdAt: new Date(event.createdAt),
        },
      })
      migrated += 1
    }
  }

  console.log(`✅ 旧时间线迁移完成：检查 ${jobs.length} 个岗位，写入/确认 ${migrated} 条事件`)
} finally {
  await prisma.$disconnect()
}
