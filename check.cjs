  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()
  p.user.findMany({ select: { username: true } }).then(u => {
    console.log('用户列表:', u.map(x => x.username))
    p.$disconnect()
  })