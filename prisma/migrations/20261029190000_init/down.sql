ALTER TABLE "resumenes_conversacion" DROP CONSTRAINT "resumenes_conversacion_equipo_id_fkey";
ALTER TABLE "activaciones_imprevisto" DROP CONSTRAINT "activaciones_imprevisto_usuario_id_fkey";
ALTER TABLE "activaciones_imprevisto" DROP CONSTRAINT "activaciones_imprevisto_equipo_id_fkey";
ALTER TABLE "conversaciones" DROP CONSTRAINT "conversaciones_usuario_id_fkey";
ALTER TABLE "conversaciones" DROP CONSTRAINT "conversaciones_equipo_id_fkey";
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_equipo_id_fkey";

DROP TABLE "resumenes_conversacion";
DROP TABLE "activaciones_imprevisto";
DROP TABLE "conversaciones";
DROP TABLE "usuarios";
DROP TABLE "equipos";
DROP TABLE "cohorte";
