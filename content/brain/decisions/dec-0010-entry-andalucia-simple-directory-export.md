# DEC-0010 — ENTRY / Directorio sencillo de Andalucía para depuración con el patronato

## Identidad

- **ID:** `DEC-0010`
- **Estado de la decisión:** `approved` (diseño aprobado por el usuario)
- **Fecha:** 2026-11-09 (Honduras)
- **Próximo paso previsto:** implementar en Minerva Console a partir del 2026-11-10, sujeto a revisión técnica y autorización de cambios
- **Producto:** ENTRY / Minerva Console
- **Comunidad piloto:** Residencial Andalucía
- **Etiquetas:** entry, andalucia, minerva-console, excel, export, unit-connections, patronato, data-quality
- **Relacionados:** `PRJ-0001`, `DEC-0004`, `DEC-0005`, `DEC-0008`

## Contexto / problema a resolver

El directorio de Andalucía fue depurado manualmente: nombres de casas, apartamentos y negocios, relaciones administrativas entre apartamentos y referencias de ubicación. El objetivo ahora es entregar al patronato un archivo de Excel **sencillo, bonito y fácil de entender** para que ayude a corregir errores y completar información del directorio.

Se evaluó primero un reporte ejecutivo demasiado complejo (múltiples hojas, métricas, paneles y estados). Se descartó para el patronato porque resultaba difícil de digerir incluso para el operador. Se aprobó en su lugar la maqueta `Andalucia_Directorio_Conjunto_Edificio_DEMO.xlsx` presentada en la conversación del 2026-11-09: una única tabla filtrable, con datos ficticios de demostración.

**Frase directriz:** «No queremos un dashboard de auditoría; queremos un directorio que el patronato pueda corregir en cinco minutos».

## Decisión aprobada — Formato único

**Una sola hoja de Excel**, con una fila por **unidad física/operativa independiente**, y exactamente estas siete columnas visibles, en este orden:

| Columna | Contenido esperado |
| --- | --- |
| **Tipo** | Casa, Apartamento o Negocio; si no puede determinarse de manera confiable, marcar como pendiente de confirmar, nunca inventar |
| **Unidad / negocio** | Nombre visible de la unidad (`houses.house_label`) o denominación comercial validada |
| **Conjunto / edificio** | Nombre común del conjunto relacionado por `entry_unit_links`, cuando exista una asociación verificada; para unidades aisladas, mostrar `—` |
| **Referencia para ubicar** | Número de casa, referencia pública y/o descripción de ubicación disponibles; mantener la referencia física aunque se haya renombrado la unidad |
| **Residentes / contacto** | Nombres de residentes actualmente vinculados a esa unidad o contacto comercial permitido, sin fusionar personas de unidades distintas |
| **Revisión** | Campo sencillo para el patronato: `Por revisar`, `Correcto`, `Corregir` (idealmente lista desplegable en Excel) |
| **Corrección** | Espacio vacío editable para que el patronato indique qué debe cambiarse o qué falta |

Características visuales: presentación profesional alineada con Minerva (acentos rojos, legibilidad y jerarquía discreta), título claro «Directorio de Residencial Andalucía», filas bien separadas, filtros y encabezados congelados. Ordenar los apartamentos de un mismo conjunto juntos. **Sin gráficos, múltiples pestañas, panel de KPIs, auditoría interna, análisis de invitaciones ni lenguaje técnico innecesario.**

La demostración aprobada utilizaba **datos completamente ficticios**. El exportador real empleará únicamente datos autorizados del alcance comunitario seleccionado.

## Semántica del campo «Conjunto / edificio»

Se escogió explícitamente **«Conjunto / edificio»** en lugar de **«Pertenece a»**, porque la palabra «pertenece» sugiere propiedad legal o dependencia jerárquica.

- La fuente de asociaciones es `entry_unit_links`, filtrada por comunidad y por conexiones activas (`ended_at IS NULL`). Las casas/unidades viven en `houses`.
- Las relaciones son **administrativas, simétricas, opcionales y reversibles**: no son propiedad, relación padre-hijo, identidad compartida ni transferencia de permisos.
- Todos los apartamentos siguen siendo unidades independientes con sus propios residentes y accesos.
- Cuando exista un conjunto verificado, mostrar un **nombre descriptivo común** para todas sus unidades, incluida la que sirve como referencia (p. ej., `Apartamentos Rodríguez` para la unidad base y para `#02`–`#06`).
- **No hay una entidad «edificio» formal ni jerarquía almacenada en el enlace**. El exportador deberá resolver un nombre de conjunto entendible de manera determinística y segura; si hay ambigüedad, usar `Por confirmar` o una referencia neutral y pedir revisión, sin asignar un propietario ni inventar un padre.
- **Nunca inferir vínculos automáticamente solo por nombres, apellidos o referencias parecidas**. Los grupos sin enlaces verificados se muestran con `—`, aunque su nombre sugiera proximidad.
- Los conjuntos se agrupan visualmente; no fusionar filas ni cuentas. El campo `Conjunto / edificio` no se convierte en una unidad nueva.

## Datos y fuentes a implementar

- Unidades y referencias: `houses` (`house_label`, `public_reference`, `unit_reference` y campos pertinentes verificados).
- Residencia/usuarios: `house_residents` y `profiles` (solo relaciones activas cuando corresponda y nombres apropiados para el patronato).
- Relaciones: `entry_unit_links`, con aislamiento de la comunidad y enlaces vigentes.
- Negocios: identificar la fuente/campo verídico en ENTRY antes de exportar. **No clasificar cualquier casa como negocio ni inventar entidades comerciales** cuando no hay fuente confiable.
- Tipo de unidad: validar cómo se distingue Casa/Apartamento/Negocio en el modelo actual. Si no existe un campo fiable, diseñar mapeo revisable y dejar casos dudosos como `Por confirmar`; el nombre visible puede ser una pista, no evidencia suficiente por sí sola.
- Una vivienda sin residentes activos sigue apareciendo en el directorio con un valor claro (`Sin residente registrado` o equivalente).

## Protección de datos y operación

- Exportar **solo la comunidad elegida** y tras comprobar la autorización del operador en Minerva Console. Definir la versión para compartir con patronato sin ampliar permisos del sistema.
- La hoja debe incluir solo datos necesarios para revisión del directorio; **no exportar PIN, tokens, QR, historial de accesos, credenciales, métricas de seguridad, teléfonos, emails o identificadores internos por defecto**.
- No introducir `Responsible contacts` en el diseño actual: **asignación de responsables aplazada por decisión del usuario**.
- Ningún cambio en la hoja editada debe escribir automáticamente en producción. Las correcciones del patronato serán revisadas y aplicadas posteriormente por un operador autorizado.
- Evitar fallos en exportación por datos incompletos, y no consultar datos de otras comunidades.
- Exportación propuesta desde **Minerva Console → Community Detail → Exportar directorio Excel**. El archivo incluirá fecha de corte/fecha de generación y una breve leyenda para que el patronato sepa completar `Revisión` y `Corrección`.

## Criterios de aceptación del trabajo futuro

1. Un botón/acción de exportar en el detalle autorizado de la comunidad genera un `.xlsx` funcional.
2. El archivo muestra **una sola hoja y siete columnas**, tal como se aprobaron; legible en Excel con filtros, encabezados fijos y revisión/corrección editables.
3. Se incluyen casas, apartamentos y negocios **con respaldo real**, sin duplicar unidades; los residentes activos quedan asociados únicamente a su unidad.
4. `Conjunto / edificio` deriva de relaciones vigentes verificadas, mantiene unidades independientes y no implica propiedad ni responsabilidad.
5. Las referencias físicas existentes sobreviven al cambio de nombre visible (p. ej., `Casa 1363`).
6. Ausencias o ambigüedades se muestran de forma explícita, no se inventan asociaciones ni ocupantes.
7. La exportación es de solo lectura, está limitada por comunidad y excluye información sensible/no necesaria.
8. QA con datos ficticios y una revisión autorizada de Andalucía antes de distribuir el archivo al patronato.
9. **No se implementa ni despliega como parte de esta decisión**; la tarea de ingeniería se retoma después.

## Estado de la implementación / límites

- **Diseño:** APROBADO por el usuario, 2026-11-09.
- **Demo:** archivo ficticio `Andalucia_Directorio_Conjunto_Edificio_DEMO.xlsx` compartido en el chat del proyecto Minerva Core Brain. El archivo temporal del chat no es una fuente de datos productiva.
- **Implementación:** PENDIENTE. No crear funcionalidad, consultas productivas, exportaciones reales ni cambios de permisos en el PR de captura de esta decisión.
- **Entrega:** pendiente de pruebas y revisión antes de enviarse al patronato.
