import bcrypt from 'bcryptjs'
import prisma from './prisma'

const DEMO_USERNAME = 'user'
const DEMO_PASSWORD = '000000'

const id = () => crypto.randomUUID()

function generateQuizQuestions(idx) {
  const questions = [
    { id: id(), question: '实现一个 LRU Cache，要求 get 和 put 都是 O(1)', myAnswer: '使用 HashMap + 双向链表', satisfaction: 4, betterAnswer: '可以用 LinkedHashMap 实现，但手写双向链表更能展示功底', skills: '数据结构, 算法' },
    { id: id(), question: '分布式缓存和数据库一致性如何保证？', myAnswer: '先更新数据库再删除缓存', satisfaction: 3, betterAnswer: '应该补充 Canal 监听 binlog 的方案', skills: '分布式, 缓存' },
    { id: id(), question: 'React Fiber 架构的原理是什么？', myAnswer: 'Fiber 是 React 16 引入的新的协调引擎', satisfaction: 2, betterAnswer: '应该详细说明 Fiber 节点数据结构、双缓存机制和 workLoop 执行过程', skills: 'React, 前端架构' },
    { id: id(), question: '手写 Promise.all 的实现', myAnswer: '只写了一半', satisfaction: 1, betterAnswer: '需要完整实现：接受可迭代对象，返回 Promise，收集结果后 resolve', skills: 'JavaScript, Promise' },
    { id: id(), question: 'JVM 调优经验分享：如何处理频繁 Full GC？', myAnswer: '从 GC 日志分析入手，调整堆内存分配', satisfaction: 5, betterAnswer: '还可以补充使用 G1 替换 CMS、调整 Region 大小等调优参数', skills: 'JVM, 性能调优' },
    { id: id(), question: '设计一个高并发秒杀系统', myAnswer: '从流量控制、缓存策略、队列削峰等角度阐述', satisfaction: 4, betterAnswer: '可以补充降级方案和数据最终一致性的保证措施', skills: '系统设计, 高并发' },
    { id: id(), question: '如何理解领域驱动设计（DDD）？', myAnswer: '简要回答了实体、值对象、聚合等基本概念', satisfaction: 2, betterAnswer: '需要结合具体案例讲解限界上下文、领域事件、事件风暴等实践方法', skills: 'DDD, 架构设计' },
    { id: id(), question: '如何优化 React 应用的性能？', myAnswer: '提到 memo、useMemo、useCallback 等', satisfaction: 3, betterAnswer: '还应补充虚拟列表、代码分割、懒加载等策略', skills: 'React, 性能优化' },
    { id: id(), question: 'Java 多线程中的可见性如何保证？', myAnswer: '提到 volatile 关键字', satisfaction: 2, betterAnswer: '应该说明 volatile 内存语义、happens-before 规则', skills: 'Java, 多线程' },
    { id: id(), question: 'Java 内存模型和 volatile 的原理', myAnswer: '完整回答了 volatile 内存语义和 happens-before 保证', satisfaction: 4, betterAnswer: '可以举例说明 volatile 在 DCL 单例模式中的应用', skills: 'Java, JMM' },
    { id: id(), question: '介绍你参与过的微服务项目架构', myAnswer: '从整体业务出发，按领域拆分为多个微服务', satisfaction: 4, betterAnswer: '可以更突出服务拆分的设计思路和技术选型对比', skills: '微服务, 架构设计' },
    { id: id(), question: '你们项目的技术选型是怎么考虑的？', myAnswer: '结合业务场景和团队技术栈阐述了选型考量', satisfaction: 4, betterAnswer: '可以用更结构化的方式对比不同技术方案的优劣', skills: '架构设计, 技术选型' },
    { id: id(), question: '如果你来设计我们的下一代架构，你会怎么做？', myAnswer: '从现有架构痛点出发，提出了演进式架构的思路', satisfaction: 3, betterAnswer: '应该更具体地给出架构演进路线图和阶段性目标', skills: '架构设计, 技术规划' },
    { id: id(), question: '如何看待开源技术选型中的风险管理？', myAnswer: '提到了社区活跃度、团队技术储备等因素', satisfaction: 3, betterAnswer: '还应该考虑 License 合规、安全漏洞响应等因素', skills: '技术管理, 风险管理' },
  ]
  const start = (idx * 3) % questions.length
  return questions.slice(start, start + 3)
}

function generateImprovements() {
  return [
    { id: id(), action: '复习分布式缓存一致性方案', done: false },
    { id: id(), action: '准备系统设计文档', done: true },
    { id: id(), action: '整理面试题 checklist', done: false },
  ].slice(0, 2 + Math.floor(Math.random() * 2))
}

/**
 * Ensure the demo user 'user' exists in the database.
 * Creates the account with the password '000000' if it does not exist.
 * Idempotent — safe to call on every login attempt.
 */
export async function ensureDemoUser() {
  const existing = await prisma.user.findUnique({ where: { username: DEMO_USERNAME } })
  if (existing) return existing

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const user = await prisma.user.create({
    data: { username: DEMO_USERNAME, passwordHash },
    select: { id: true, username: true, createdAt: true },
  })
  console.log('[seedDemoData] Created demo user:', user.id)
  return user
}

/**
 * Seed demo business data for the given userId.
 * Only writes data if the user has zero jobs (idempotent).
 * Data: 14 jobs, 5 resumes, 11 tasks, 7 reviews — all cross-referenced.
 */
export async function seedDemoDataForUser(userId) {
  const existingCount = await prisma.job.count({ where: { userId } })
  if (existingCount > 0) {
    console.log('[seedDemoData] Data already exists for user', userId, '- skipping')
    return { skipped: true }
  }

  // ---- 1. Create resumes ----
  const resumeData = [
    { name: '通用技术简历', version: 'v3.2', updatedAt: '2026-05-09', target: '后端/全栈', language: '中文', format: 'PDF', fileSize: '256 KB', tags: ['技术', '后端', '全栈'], versionNote: '更新了微服务项目经历，补充K8s相关技能', fileUrl: '', isDefault: true, fileName: '', mimeType: '', hasFile: false },
    { name: '前端专项简历', version: 'v2.1', updatedAt: '2026-05-05', target: '前端开发', language: '中文', format: 'PDF', fileSize: '188 KB', tags: ['技术', '前端', 'React'], versionNote: '增加 React 项目经验和开源贡献', fileUrl: '', isDefault: false, fileName: '', mimeType: '', hasFile: false },
    { name: '英文简历', version: 'v1.0', updatedAt: '2026-04-28', target: '外企', language: 'English', format: 'PDF', fileSize: '312 KB', tags: ['外企', '英文'], versionNote: '初版英文简历，适配外企岗位', fileUrl: '', isDefault: false, fileName: '', mimeType: '', hasFile: false },
    { name: '架构方向简历', version: 'v1.0', updatedAt: '2026-04-20', target: '架构师', language: '中文', format: 'DOCX', fileSize: '420 KB', tags: ['技术', '架构', '高并发'], versionNote: '突出系统设计和架构经验', fileUrl: '', isDefault: false, fileName: '', mimeType: '', hasFile: false },
    { name: '实习简版', version: 'v2.0', updatedAt: '2026-04-10', target: '实习/校招', language: '中文', format: 'PDF', fileSize: '156 KB', tags: ['校招', '实习'], versionNote: '精简版简历，突出基础能力和项目亮点', fileUrl: '', isDefault: false, fileName: '', mimeType: '', hasFile: false },
  ]
  const createdResumes = []
  for (const r of resumeData) {
    createdResumes.push(await prisma.resume.create({ data: { userId, ...r } }))
  }

  // ---- 2. Create jobs ----
  const rawJobData = [
    { companyName: 'ByteDance', jobTitle: '高级后端工程师', status: '二面中', city: '北京', salaryRange: '35K-50K', workMode: ' onsite', channel: '内推', priority: '高', appliedDate: '2026-04-28', jobLink: '', jdText: '', contactName: '李学长', contactInfo: '微信: xxx', nextAction: '2026-05-14 二面', notes: '算法题要多练', endReason: '', interviewRounds: [{ id: id(), round: '一面', status: '已通过', date: '2026-05-08', result: '通过', notes: '技术面，算法题2道，系统设计1道' }], timeline: [{ date: '2026-04-28', action: '投递简历', detail: '通过内推投递' }, { date: '2026-05-03', action: '简历筛选通过', detail: 'HR 联系安排一面' }, { date: '2026-05-08', action: '一面完成', detail: '技术面，算法题2道，系统设计1道' }, { date: '2026-05-10', action: '进入二面', detail: '等待二面通知' }] },
    { companyName: 'Alibaba', jobTitle: '后端开发工程师', status: '笔试/在线测评', city: '杭州', salaryRange: '30K-45K', workMode: ' onsite', channel: '官网投递', priority: '高', appliedDate: '2026-05-01', jobLink: '', jdText: '', contactName: '', contactInfo: '', nextAction: '2026-05-15 笔试截止', notes: '', endReason: '', timeline: [{ date: '2026-05-01', action: '投递简历', detail: '官网直投' }, { date: '2026-05-06', action: '收到笔试链接', detail: '需要在5月15日前完成' }] },
    { companyName: 'Tencent', jobTitle: '全栈开发工程师', status: '已投递', city: '深圳', salaryRange: '35K-55K', workMode: ' onsite', channel: '猎头', priority: '中', appliedDate: '2026-05-06', jobLink: '', jdText: '', contactName: '王猎头', contactInfo: '电话: 138xxxx', nextAction: '等待筛选结果', notes: '', endReason: '', timeline: [{ date: '2026-05-06', action: '投递简历', detail: '通过猎头推荐投递' }] },
    { companyName: 'Meituan', jobTitle: '后端开发工程师', status: 'Offer', city: '北京', salaryRange: '28K-42K', workMode: ' onsite', channel: '内推', priority: '中', appliedDate: '2026-04-15', jobLink: '', jdText: '', contactName: '刘师兄', contactInfo: '微信: llyy', nextAction: '2026-05-20 前确认', notes: '团队氛围不错，薪资可谈', endReason: '', interviewRounds: [{ id: id(), round: '一面', status: '已通过', date: '2026-04-20', result: '通过', notes: '技术面，考察Java基础' }, { id: id(), round: '二面', status: '已通过', date: '2026-04-25', result: '通过', notes: '主管面，聊项目经验' }], timeline: [{ date: '2026-04-15', action: '投递简历', detail: '内推投递' }, { date: '2026-04-20', action: '一面', detail: '技术面，考察Java基础' }, { date: '2026-04-25', action: '二面', detail: '主管面，聊项目经验' }, { date: '2026-05-01', action: 'HR 面', detail: '谈薪资和入职时间' }, { date: '2026-05-08', action: '收到 Offer', detail: '28K * 15薪' }] },
    { companyName: 'Xiaomi', jobTitle: '服务端开发工程师', status: '已结束', city: '北京', salaryRange: '25K-38K', workMode: ' onsite', channel: '官网投递', priority: '低', appliedDate: '2026-04-10', jobLink: '', jdText: '', contactName: '', contactInfo: '', nextAction: '', notes: '技术栈不匹配', endReason: '被拒绝', timeline: [{ date: '2026-04-10', action: '投递简历', detail: '官网投递' }, { date: '2026-04-18', action: '简历未通过', detail: '技术栈匹配度不够' }] },
    { companyName: 'Pinduoduo', jobTitle: '后端研发工程师', status: '感兴趣', city: '上海', salaryRange: '35K-50K', workMode: ' onsite', channel: '', priority: '中', appliedDate: '', jobLink: 'https://example.com/pdd', jdText: '负责电商后端系统设计开发...', contactName: '', contactInfo: '', nextAction: '了解一下团队情况', notes: '拼多多核心部门', endReason: '', timeline: [] },
    { companyName: 'Baidu', jobTitle: 'AI平台后端开发', status: '待投递', city: '北京', salaryRange: '30K-48K', workMode: ' onsite', channel: '', priority: '高', appliedDate: '', jobLink: 'https://example.com/baidu', jdText: '负责AI平台后端服务开发...', contactName: '', contactInfo: '', nextAction: '修改简历后投递', notes: '需要准备系统设计', endReason: '', timeline: [] },
    { companyName: 'NetEase', jobTitle: '游戏后端开发', status: '感兴趣', city: '广州', salaryRange: '28K-45K', workMode: ' onsite', channel: '', priority: '低', appliedDate: '', jobLink: '', jdText: '', contactName: '', contactInfo: '', nextAction: '', notes: '游戏方向，需要考虑', endReason: '', timeline: [] },
    { companyName: 'Bilibili', jobTitle: 'Go 后端开发', status: '待投递', city: '上海', salaryRange: '28K-42K', workMode: ' onsite', channel: '内推', priority: '中', appliedDate: '', jobLink: '', jdText: '', contactName: '陈学姐', contactInfo: 'B站内部', nextAction: '联系学姐了解详情', notes: '', endReason: '', timeline: [] },
    { companyName: '快手', jobTitle: '后端架构师', status: '笔试/在线测评', city: '北京', salaryRange: '40K-60K', workMode: ' hybrid', channel: '猎头', priority: '高', appliedDate: '2026-05-04', jobLink: '', jdText: '', contactName: '张猎头', contactInfo: '微信: zlt', nextAction: '2026-05-16 笔试', notes: '架构方向，需要准备分布式', endReason: '', timeline: [{ date: '2026-05-04', action: '投递简历', detail: '猎头推荐' }, { date: '2026-05-08', action: '简历通过', detail: '发送了笔试链接' }] },
    { companyName: '小红书', jobTitle: '后端开发工程师', status: '已投递', city: '上海', salaryRange: '30K-45K', workMode: ' onsite', channel: '官网投递', priority: '中', appliedDate: '2026-05-09', jobLink: '', jdText: '', contactName: '', contactInfo: '', nextAction: '等待反馈', notes: '', endReason: '', timeline: [{ date: '2026-05-09', action: '投递简历', detail: '官网直投' }] },
    { companyName: '蚂蚁集团', jobTitle: 'Java 高级开发', status: '三面中', city: '杭州', salaryRange: '35K-55K', workMode: ' onsite', channel: '内推', priority: '高', appliedDate: '2026-04-20', jobLink: '', jdText: '', contactName: '赵同学', contactInfo: '钉钉: zhao', nextAction: '2026-05-13 三面', notes: '业务很核心，需要准备高并发', endReason: '', interviewRounds: [{ id: id(), round: '一面', status: '已通过', date: '2026-04-26', result: '通过', notes: '技术基础面' }, { id: id(), round: '二面', status: '已通过', date: '2026-05-05', result: '通过', notes: '项目深挖，系统设计' }], timeline: [{ date: '2026-04-20', action: '投递简历', detail: '内推投递' }, { date: '2026-04-26', action: '一面', detail: '技术基础面' }, { date: '2026-05-05', action: '二面', detail: '项目深挖，系统设计' }, { date: '2026-05-10', action: '进入三面', detail: '等待主管面' }] },
    { companyName: '得物', jobTitle: '后端开发', status: '已结束', city: '上海', salaryRange: '26K-40K', workMode: ' onsite', channel: '官网投递', priority: '低', appliedDate: '2026-03-25', jobLink: '', jdText: '', contactName: '', contactInfo: '', nextAction: '', notes: '流程太长了', endReason: '自己放弃', interviewRounds: [{ id: id(), round: '一面', status: '已通过', date: '2026-04-02', result: '通过', notes: '技术面' }, { id: id(), round: '二面', status: '已通过', date: '2026-04-15', result: '通过', notes: '项目面' }], timeline: [{ date: '2026-03-25', action: '投递简历', detail: '官网投递' }, { date: '2026-04-02', action: '一面', detail: '技术面' }, { date: '2026-04-15', action: '二面', detail: '项目面' }, { date: '2026-04-28', action: '主动放弃', detail: '流程过长，已接受其他 Offer' }] },
    { companyName: '京东', jobTitle: '后端架构师', status: '二面中', city: '北京', salaryRange: '38K-55K', workMode: ' onsite', channel: '猎头', priority: '中', appliedDate: '2026-04-22', jobLink: '', jdText: '', contactName: '刘猎头', contactInfo: '电话: 139xxxx', nextAction: '等 HR 通知', notes: '架构方向需要补充DDD知识', endReason: '', interviewRounds: [{ id: id(), round: '一面', status: '已通过', date: '2026-04-28', result: '通过', notes: '技术面，考察架构设计' }], timeline: [{ date: '2026-04-22', action: '投递简历', detail: '猎头推荐' }, { date: '2026-04-28', action: '一面', detail: '技术面，考察架构设计' }, { date: '2026-05-06', action: '二面', detail: 'CTO 面' }] },
  ]

  // Link resumes to jobs
  const resumeLinks = [
    { jobIdx: 0, resumeIdx: 0 }, { jobIdx: 1, resumeIdx: 0 }, { jobIdx: 2, resumeIdx: 0 },
    { jobIdx: 3, resumeIdx: 0 }, { jobIdx: 4, resumeIdx: 0 }, { jobIdx: 9, resumeIdx: 0 },
    { jobIdx: 10, resumeIdx: 0 }, { jobIdx: 11, resumeIdx: 0 },
    { jobIdx: 7, resumeIdx: 2 }, { jobIdx: 12, resumeIdx: 3 }, { jobIdx: 13, resumeIdx: 3 },
  ]
  resumeLinks.forEach(({ jobIdx, resumeIdx }) => {
    rawJobData[jobIdx].resumeId = createdResumes[resumeIdx].id
  })
  for (let i = 0; i < rawJobData.length; i++) {
    if (!rawJobData[i].resumeId) rawJobData[i].resumeId = createdResumes[0].id
  }

  const createdJobs = []
  for (const j of rawJobData) {
    createdJobs.push(await prisma.job.create({ data: { userId, ...j } }))
  }

  // ---- 3. Create tasks ----
  const taskData = [
    { title: 'ByteDance 技术二面', type: '面试', date: '2026-05-14', startTime: '10:00', endTime: '11:00', priority: '高', done: false, jobId: createdJobs[0].id, notes: '准备系统设计' },
    { title: '完成 Alibaba 在线笔试', type: '笔试/在线测评', date: '2026-05-15', startTime: '23:59', endTime: '', priority: '高', done: false, jobId: createdJobs[1].id, notes: '算法 + 行测' },
    { title: '蚂蚁集团三面', type: '面试', date: '2026-05-13', startTime: '14:30', endTime: '15:30', priority: '高', done: false, jobId: createdJobs[11].id, notes: '主管面，准备BQ问题' },
    { title: '快手笔试截止', type: 'Deadline', date: '2026-05-16', startTime: '23:59', endTime: '', priority: '中', done: false, jobId: createdJobs[9].id, notes: '2小时，4道算法' },
    { title: '跟进 ByteDance 二面结果', type: 'Follow-up', date: '2026-05-15', startTime: '', endTime: '', priority: '中', done: false, jobId: createdJobs[0].id, notes: '发感谢信并询问后续' },
    { title: '复习系统设计', type: '准备任务', date: '2026-05-12', startTime: '20:00', endTime: '22:00', priority: '中', done: false, jobId: '', notes: '分布式系统常见面试题' },
    { title: 'Meituan Offer 确认截止', type: 'Deadline', date: '2026-05-20', startTime: '23:59', endTime: '', priority: '高', done: false, jobId: createdJobs[3].id, notes: '需要回复确认邮件' },
    { title: '修改简历 - 后端通用版', type: '准备任务', date: '2026-05-12', startTime: '15:00', endTime: '17:00', priority: '低', done: true, jobId: '', notes: '更新项目经历' },
    { title: '整理 Tencent 面经', type: '其他', date: '2026-05-11', startTime: '17:00', endTime: '18:00', priority: '低', done: true, jobId: createdJobs[2].id, notes: '' },
    { title: 'LeetCode 每日一题', type: '准备任务', date: '2026-05-12', startTime: '09:00', endTime: '10:00', priority: '低', done: true, jobId: '', notes: '' },
    { title: 'Follow-up 京东二面', type: 'Follow-up', date: '2026-05-13', startTime: '', endTime: '', priority: '中', done: false, jobId: createdJobs[13].id, notes: '询问面试结果' },
  ]
  for (const t of taskData) {
    await prisma.task.create({ data: { userId, ...t } })
  }

  // ---- 4. Create reviews ----
  const companies = ['ByteDance', 'Tencent', 'Alibaba', '蚂蚁集团', '蚂蚁集团', '京东', '京东']
  const jobTitles = ['高级后端工程师', '全栈开发工程师', '后端开发工程师', 'Java 高级开发', 'Java 高级开发', '后端架构师', '后端架构师']
  const rounds = ['一面', '一面', '一面', '一面', '二面', '一面', '二面']
  const results = ['通过', '待定', '未通过', '通过', '通过', '通过', '待定']
  const ratings = [4, 3, 2, 4, 4, 3, 3]
  const interviewTypes = ['技术面', '技术面', '技术面', '技术面', '技术面', '技术面', '主管面']
  const interviewDates = ['2026-05-08', '2026-05-08', '2026-05-05', '2026-04-26', '2026-05-05', '2026-04-28', '2026-05-06']
  const durations = ['1小时', '1.5小时', '1小时', '1.5小时', '1小时', '1小时', '45分钟']
  const strengths = ['算法基础扎实，项目经验丰富', '项目经验匹配，沟通流畅', '基础知识面较广', 'JVM 调优经验丰富，项目有深度', '架构思维清晰，系统设计完整', '有微服务实践经验', '技术视野不错，学习能力强']
  const weaknesses = ['系统设计部分深度不够', '前端原理理解不够深入', '手写代码能力不足，并发编程理解浅', '分布式理论需要系统学习', '某些细节实现考虑不周', 'DDD 领域驱动设计理解不够', '技术选型决策不够果断']
  const interviewers = ['王工，后端技术负责人', '陈工，前端技术负责人', '', '赵同学（内推人）', '孙总，技术总监', '', '李总，CTO']
  const notes_arr = [
    '算法题全部 AC，系统设计需要加强。面试官很专业，考察了分布式缓存和消息队列。',
    '项目经验匹配度还可以，但对前端框架深度挖掘时表现不够。React 原理需要再深入理解。',
    '手写题没有完成，Promise 链和异步编程需要复习。Java 并发问题回答不够完整。',
    '技术基础扎实，JVM 调优经验打动面试官。后续需要准备分布式事务。',
    '项目深挖环节表现不错，系统设计题回答完整。面试官对架构思路表示认可。',
    '架构设计经验尚可，DDD 理解需要加深。整体表现中上。',
    'CTO 面主要考察技术视野和团队协作。回答比较流畅，但技术选型方面可以更果断。',
  ]
  const jobIdxs = [0, 2, 1, 11, 11, 13, 13]

  for (let i = 0; i < companies.length; i++) {
    await prisma.review.create({
      data: {
        userId,
        companyName: companies[i],
        jobTitle: jobTitles[i],
        jobId: createdJobs[jobIdxs[i]].id,
        round: rounds[i],
        interviewType: interviewTypes[i],
        interviewDate: interviewDates[i],
        duration: durations[i],
        interviewerInfo: interviewers[i],
        result: results[i],
        rating: ratings[i],
        note: notes_arr[i],
        strengths: strengths[i],
        weaknesses: weaknesses[i],
        scores: { expression: 4, jobUnderstanding: 3, projectFamiliarity: 4, businessThinking: 3, technicalAbility: 3, composure: 3, questionQuality: 3, overall: ratings[i] },
        questions: generateQuizQuestions(i),
        tags: i % 2 === 0 ? ['项目细节不熟', '业务思考不足'] : ['知识盲区', '技术能力不足'],
        improvements: generateImprovements(),
        attachments: [],
      },
    })
  }

  console.log('[seedDemoData] Seeded data for user', userId)
  return { skipped: false }
}
