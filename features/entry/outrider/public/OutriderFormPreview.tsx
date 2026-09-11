"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Establishment = { name: string; type: string };

export function OutriderFormPreview() {
  const [unitTypes, setUnitTypes] = useState(["casas"]);
  const [otherUnitType, setOtherUnitType] = useState("");
  const [unitNamingExample, setUnitNamingExample] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([
    { name: "", type: "" },
  ]);
  const [destinations, setDestinations] = useState([""]);
  const [securityCount, setSecurityCount] = useState("4");
  const [securityNames, setSecurityNames] = useState(["", "", "", ""]);
  const [securityNotes, setSecurityNotes] = useState("");

  const toggleUnit = (type: string) =>
    setUnitTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );

  const setGuardCount = (value: string) => {
    const count = Number(value);
    setSecurityCount(value);
    setSecurityNames((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? ""),
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-lg border border-slate-200 bg-white px-4 py-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">ENTRY</p>
          <h1 className="mt-2 text-2xl font-semibold">Preparación de Residencial Andalucía</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Esta información nos ayudará a preparar ENTRY para su comunidad. Puede completarla poco a poco.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[80%] rounded-full bg-violet-700" /></div>
            <span className="text-sm font-semibold text-slate-700">80% completo</span>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader number="1" title="Unidades" />
          <p className="mt-4 text-sm font-semibold">¿Qué tipos de unidades existen en la comunidad?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {["casas", "apartamentos", "condominios", "oficinas", "otro"].map((type) => (
              <label key={type} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={unitTypes.includes(type)} onChange={() => toggleUnit(type)} />
                <span>{type === "otro" ? "Otro" : type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </label>
            ))}
          </div>
          {unitTypes.includes("otro") && (
            <label className="mt-3 block text-sm font-semibold">¿Cuál?
              <input value={otherUnitType} onChange={(e) => setOtherUnitType(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-violet-600" />
            </label>
          )}
          <label className="mt-5 block text-sm font-semibold">¿Cómo desean que aparezcan las unidades dentro de ENTRY?
            <p className="mt-1 font-normal text-slate-500">Indique un ejemplo de cómo identifican actualmente sus unidades.</p>
            <input value={unitNamingExample} onChange={(e) => setUnitNamingExample(e.target.value)} placeholder="Ej. Casa 1309" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-violet-600" />
          </label>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader number="2" title="Establecimientos y destinos" />
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold">Establecimientos y lugares con nombre propio</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Registre lugares de la comunidad que deban quedar identificados en ENTRY.</p>
            <div className="mt-3 space-y-2">
              {establishments.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <input value={item.name} onChange={(e) => setEstablishments((all) => all.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} placeholder="Ej. Industria Eugenes" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600" />
                  <select value={item.type} onChange={(e) => setEstablishments((all) => all.map((row, i) => i === index ? { ...row, type: e.target.value } : row))} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600">
                    <option value="">Tipo</option><option>Taller</option><option>Comercio</option><option>Industria</option><option>Oficina</option><option>Otro</option>
                  </select>
                  {establishments.length > 1 && <button type="button" onClick={() => setEstablishments((all) => all.filter((_, i) => i !== index))} className="grid h-11 w-11 place-items-center rounded-md border border-slate-300 text-slate-500"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setEstablishments((all) => [...all, { name: "", type: "" }])} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Agregar establecimiento</button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold">Destinos de la comunidad</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Agregue los nombres de los lugares a los que pueden dirigirse las visitas.</p>
            <div className="mt-3 space-y-2">
              {destinations.map((value, index) => <input key={index} value={value} onChange={(e) => setDestinations((all) => all.map((row, i) => i === index ? e.target.value : row))} placeholder={index === 0 ? "Ej. Casa Club" : "Otro destino"} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600" />)}
              <button type="button" onClick={() => setDestinations((all) => [...all, ""])} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Agregar otro destino</button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader number="3" title="Unidades desactivadas" />
          <p className="mt-4 text-sm font-semibold">¿Hay unidades que no deben comenzar activas al iniciar ENTRY?</p>
          <div className="mt-3 flex gap-2"><button className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold">Sí</button><button className="h-10 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white">No</button></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader number="4" title="Información disponible" />
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold">Personal de seguridad</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Indique cuántas personas forman parte actualmente del personal de seguridad y, si desea, agregue sus nombres.</p>
            <label className="mt-3 block text-sm font-semibold">Cantidad de personal de seguridad
              <select value={securityCount} onChange={(e) => setGuardCount(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-violet-600"><option value="">Seleccione</option>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
            </label>
            {securityNames.length > 0 && <div className="mt-3 space-y-2">{securityNames.map((name, index) => <input key={index} value={name} onChange={(e) => setSecurityNames((all) => all.map((row, i) => i === index ? e.target.value : row))} placeholder={`Nombre del guardia ${index + 1}`} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600" />)}</div>}
            <label className="mt-3 block text-sm font-semibold">Información adicional <span className="font-normal text-slate-500">(opcional)</span><textarea value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} rows={3} placeholder="Turnos u otra información útil" className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-violet-600" /></label>
          </div>
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">Si ya tiene un archivo con unidades, residentes o ambos, envíelo tal como lo utiliza administración. No necesita reorganizarlo.</div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader number="5" title="Contacto y administradores" />
          <p className="mt-4 text-sm font-semibold">Contacto principal</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><input placeholder="Nombre" className="h-11 rounded-md border border-slate-300 px-3 text-sm" /><input placeholder="Teléfono" className="h-11 rounded-md border border-slate-300 px-3 text-sm" /><input placeholder="Correo electrónico" className="h-11 rounded-md border border-slate-300 px-3 text-sm sm:col-span-2" /></div>
          <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-sm font-semibold">Administradores iniciales de ENTRY</p><p className="mt-1 text-sm text-slate-600">Prepare las activaciones de las personas que administrarán la comunidad.</p></div>
        </section>

        <footer className="sticky bottom-0 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-600">80% completo</p><button className="h-11 rounded-md bg-violet-700 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white">Enviar para revisión</button></div></footer>
      </div>
    </main>
  );
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">{number}</span><h2 className="text-lg font-semibold">{title}</h2></div>;
}
