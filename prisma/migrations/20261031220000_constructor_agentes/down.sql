ALTER TABLE "conversaciones" DROP CONSTRAINT "conversaciones_version_agente_id_fkey";
DROP INDEX "conversaciones_version_agente";
ALTER TABLE "conversaciones" DROP COLUMN "duracion_segundos";
ALTER TABLE "conversaciones" DROP COLUMN "version_agente_id";

DROP TABLE "simulaciones";
DROP TABLE "topes_equipo";
DROP TABLE "versiones_agente";
DROP TABLE "agentes_equipo";
