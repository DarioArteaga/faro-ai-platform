export class ErrorHttp extends Error {
  readonly status: number

  constructor(status: number, detalle: string) {
    super(detalle)
    this.status = status
  }
}
