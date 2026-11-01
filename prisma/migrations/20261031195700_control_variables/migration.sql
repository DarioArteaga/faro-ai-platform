-- AlterTable
ALTER TABLE "conversaciones" ADD COLUMN "equipo_enviado" TEXT;
ALTER TABLE "conversaciones" ADD COLUMN "control_variables" TEXT NOT NULL DEFAULT 'anterior';
ALTER TABLE "conversaciones" ADD COLUMN "claves_alteradas" VARCHAR(200);
