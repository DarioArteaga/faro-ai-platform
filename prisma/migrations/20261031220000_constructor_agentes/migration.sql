-- CreateTable
CREATE TABLE "agentes_equipo" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "primer_mensaje" TEXT NOT NULL,
    "voz_slug" TEXT NOT NULL,
    "modelo_slug" TEXT NOT NULL,
    "tool_id" TEXT,
    "secret_id" TEXT,
    "tool_url" TEXT,
    "tool_metodo" TEXT,
    "tool_descripcion" TEXT,
    "tool_parametros" JSONB,
    "archivado_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentes_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versiones_agente" (
    "id" UUID NOT NULL,
    "agente_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "usuario_id" UUID NOT NULL,
    "guardado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen_numero" INTEGER,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "versiones_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topes_equipo" (
    "equipo_id" UUID NOT NULL,
    "conversaciones_texto" INTEGER NOT NULL,
    "simulaciones" INTEGER NOT NULL,
    "minutos_voz" INTEGER NOT NULL,
    "voz_habilitada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "topes_equipo_pkey" PRIMARY KEY ("equipo_id")
);

-- CreateTable
CREATE TABLE "simulaciones" (
    "id" UUID NOT NULL,
    "agente_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "escenario" TEXT NOT NULL,
    "criterio" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "razon" TEXT NOT NULL,
    "transcripcion" TEXT NOT NULL,
    "creditos" INTEGER,
    "creada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulaciones_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "conversaciones" ADD COLUMN "version_agente_id" UUID;
ALTER TABLE "conversaciones" ADD COLUMN "duracion_segundos" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "agentes_equipo_equipo_id_key" ON "agentes_equipo"("equipo_id");

-- CreateIndex
CREATE UNIQUE INDEX "agentes_equipo_agent_id_key" ON "agentes_equipo"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "versiones_agente_agente_id_numero_key" ON "versiones_agente"("agente_id", "numero");

-- CreateIndex
CREATE INDEX "simulaciones_agente_fecha" ON "simulaciones"("agente_id", "creada_at");

-- CreateIndex
CREATE INDEX "conversaciones_version_agente" ON "conversaciones"("version_agente_id");

-- AddForeignKey
ALTER TABLE "agentes_equipo" ADD CONSTRAINT "agentes_equipo_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "versiones_agente" ADD CONSTRAINT "versiones_agente_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "agentes_equipo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "versiones_agente" ADD CONSTRAINT "versiones_agente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "topes_equipo" ADD CONSTRAINT "topes_equipo_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulaciones" ADD CONSTRAINT "simulaciones_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "agentes_equipo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulaciones" ADD CONSTRAINT "simulaciones_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "versiones_agente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulaciones" ADD CONSTRAINT "simulaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_version_agente_id_fkey" FOREIGN KEY ("version_agente_id") REFERENCES "versiones_agente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
