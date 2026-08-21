-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "city" TEXT,
    "salaryRange" TEXT,
    "workMode" TEXT,
    "channel" TEXT,
    "priority" TEXT,
    "appliedDate" TEXT,
    "jobLink" TEXT,
    "jdText" TEXT,
    "resumeId" TEXT,
    "contactName" TEXT,
    "contactInfo" TEXT,
    "nextAction" TEXT,
    "notes" TEXT,
    "endReason" TEXT,
    "interviewRounds" JSONB,
    "timeline" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "updatedAt" TEXT,
    "target" TEXT,
    "language" TEXT,
    "format" TEXT,
    "fileSize" TEXT,
    "tags" JSONB,
    "versionNote" TEXT,
    "fileUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "mimeType" TEXT,
    "hasFile" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "priority" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobId" TEXT,
    "round" TEXT,
    "interviewType" TEXT,
    "interviewDate" TEXT,
    "duration" TEXT,
    "interviewerInfo" TEXT,
    "result" TEXT,
    "rating" INTEGER,
    "note" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "scores" JSONB,
    "questions" JSONB,
    "tags" JSONB,
    "positiveTags" JSONB,
    "negativeTags" JSONB,
    "improvements" JSONB,
    "attachments" JSONB,
    "ai_analysis" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Resume_userId_idx" ON "Resume"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_jobId_idx" ON "Review"("jobId");

