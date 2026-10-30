import path from "node:path"

import { generarSitioEstatico } from "../src/lib/plan-b/generar"

generarSitioEstatico(path.join(process.cwd(), "plan-b"))
