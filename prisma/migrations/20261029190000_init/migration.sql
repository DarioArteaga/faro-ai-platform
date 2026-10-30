-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "cohorte" (
    "id" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,

    CONSTRAINT "cohorte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "equipo_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id" TEXT NOT NULL,
    "equipo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "agente_slug" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "imprevistos_activos" TEXT NOT NULL,
    "resumen_previo_enviado" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "iniciada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activaciones_imprevisto" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "activada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "activaciones_imprevisto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumenes_conversacion" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "agente_slug" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "actualizado_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumenes_conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipos_slug_key" ON "equipos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_equipo_id_idx" ON "usuarios"("equipo_id");

-- CreateIndex
CREATE INDEX "conversaciones_equipo_id_iniciada_at_idx" ON "conversaciones"("equipo_id", "iniciada_at");

-- CreateIndex
CREATE UNIQUE INDEX "activaciones_imprevisto_equipo_id_clave_key" ON "activaciones_imprevisto"("equipo_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "resumenes_conversacion_equipo_id_agente_slug_key" ON "resumenes_conversacion"("equipo_id", "agente_slug");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activaciones_imprevisto" ADD CONSTRAINT "activaciones_imprevisto_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activaciones_imprevisto" ADD CONSTRAINT "activaciones_imprevisto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "resumenes_conversacion" ADD CONSTRAINT "resumenes_conversacion_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
