-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "admin_session_id" TEXT NOT NULL,
    "imp_session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impersonation_sessions_admin_session_id_key" ON "impersonation_sessions"("admin_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "impersonation_sessions_imp_session_id_key" ON "impersonation_sessions"("imp_session_id");

-- CreateIndex
CREATE INDEX "impersonation_sessions_admin_user_id_idx" ON "impersonation_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "impersonation_sessions_imp_session_id_idx" ON "impersonation_sessions"("imp_session_id");
