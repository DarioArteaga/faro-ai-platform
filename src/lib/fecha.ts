export function formatoFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(fecha)
}
