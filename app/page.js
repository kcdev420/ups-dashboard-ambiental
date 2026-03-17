import clientPromise from "../lib/mongodb";
import DashboardClient from "./DashboardClient";

// Forzar actualización en tiempo real en Vercel
export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const client = await clientPromise;
    const db = client.db("carbono");

    const rawData = (await db.collection("raw").find({}).toArray()).map(doc => ({
      ...doc,
      _id: doc._id.toString()
    }));

    // ==========================================
    // MOTOR DE CÁLCULO LOGÍSTICO COMPLETO
    // ==========================================
    let huellaNeta = 0;
    let emisionesEvitadas = 0;
    const scopeData = { 1: 0, 2: 0, 3: 0 };
    const activityData = {};
    const vehiculosData = {};
    const facilityData = {};

    rawData.forEach(item => {
      const esReciclaje = item.activity_type && item.activity_type.toLowerCase().includes('reciclaje');
      let co2 = Number(item.co2e_kg) || 0;

      if (esReciclaje) {
        co2 = -Math.abs(co2);
        emisionesEvitadas += Math.abs(co2);
      }
      huellaNeta += co2;

      const scope = item.scope || 'N/A';
      if (!scopeData[scope]) scopeData[scope] = 0;
      scopeData[scope] += co2;

      const actividad = item.activity_type || 'Desconocida';
      if (!activityData[actividad]) activityData[actividad] = 0;
      activityData[actividad] += co2;

      if (item.placa_vehiculo && !esReciclaje) {
        if (!vehiculosData[item.placa_vehiculo]) vehiculosData[item.placa_vehiculo] = 0;
        vehiculosData[item.placa_vehiculo] += co2;
      }

      if (item.facility) {
        if (!facilityData[item.facility]) facilityData[item.facility] = 0;
        facilityData[item.facility] += co2;
      }
    });

    let topActividad = { nombre: '-', cantidad: -Infinity };
    for (const [nombre, cantidad] of Object.entries(activityData)) {
      if (cantidad > topActividad.cantidad && !nombre.toLowerCase().includes('reciclaje')) {
        topActividad = { nombre, cantidad };
      }
    }
    if (topActividad.cantidad === -Infinity) topActividad = { nombre: 'N/A', cantidad: 0 };

    let topVehiculo = { placa: 'N/A', cantidad: 0 };
    for (const [placa, cantidad] of Object.entries(vehiculosData)) {
      if (cantidad > topVehiculo.cantidad) {
        topVehiculo = { placa, cantidad };
      }
    }

    // ==========================================
    // CÁLCULOS DEL BROCHE DE ORO (EQUIVALENCIA)
    // ==========================================
    const arbolesNecesarios = Math.max(0, Math.ceil(huellaNeta / 22));
    const totalBruto = huellaNeta + emisionesEvitadas;
    const porcentajeCompensado = totalBruto > 0 ? ((emisionesEvitadas / totalBruto) * 100).toFixed(2) : 0;

    // Determinar color de alerta según la deuda (Naranja -> Rojo)
    const alertColorClass = huellaNeta > 1000 ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]";

    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
        
        {/* ENCABEZADO RESPONSIVE */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-zinc-800 pb-6 mb-8 relative">
          <div className="absolute left-0 top-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">UPS HEALTHCARE</h1>
            <p className="text-zinc-400 text-sm italic mt-1">Plataforma de Inteligencia Ambiental</p>
          </div>
          <div className="flex gap-4 relative z-10 self-start sm:self-center">
            <span className="bg-green-500/10 text-green-500 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              API & ATLAS CONNECTED
            </span>
          </div>
        </header>

        {/* SECCIÓN 1: KPIs FINANCIEROS (CUADRÍCULA RESPONSIVE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-zinc-900 p-6 rounded-xl border border-yellow-900/30 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-yellow-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Huella de Carbono Neta</p>
            <h2 className="text-3xl md:text-4xl font-black text-white relative z-10 drop-shadow-md">
              {huellaNeta.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">kg CO2e</span>
            </h2>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-green-900/50 shadow-xl relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/15 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-green-500 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Emisiones Evitadas</p>
            <h2 className="text-3xl md:text-4xl font-black text-green-400 relative z-10 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
              -{emisionesEvitadas.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">kg CO2e</span>
            </h2>
          </div>

          <div className="bg-zinc-900 p-5 rounded-xl border border-blue-900/30 shadow-xl relative overflow-hidden flex flex-col justify-center sm:col-span-2 lg:col-span-1">
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-blue-400/80 text-xs uppercase font-bold tracking-wider mb-3 relative z-10">Distribución por Scope</p>
            <div className="space-y-2 relative z-10">
              {[1, 2, 3].map((scopeNum) => (
                <div key={scopeNum} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1">
                  <span className="text-zinc-400">Scope {scopeNum}</span>
                  <span className="font-mono font-bold text-blue-400">
                    {(scopeData[scopeNum] || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: EQUIVALENCIA ECOLÓGICA (COLORES DE ALERTA LLAMATIVOS) */}
        <div className="mb-10 bg-gradient-to-r from-zinc-900 to-[#0a0a0a] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden relative">
          <div className={`absolute right-0 top-0 w-96 h-full ${huellaNeta > 1000 ? 'bg-green-500/10' : 'bg-orange-500/10'} blur-3xl rounded-full pointer-events-none`}></div>
          
          <div className="p-6 md:p-8 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 text-center lg:text-left">
              <h3 className={`text-sm font-bold uppercase tracking-widest mb-2 flex items-center justify-center lg:justify-start gap-2 text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)] ${huellaNeta > 1000 ? 'text-green-400' : 'text-orange-400'}`}>
                <span>🌱</span> Equivalencia Ecológica
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Para neutralizar la Huella de Carbono Neta generada por las operaciones actuales de UPS Healthcare, se requeriría la plantación y mantenimiento de un bosque a escala durante un año completo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center bg-black/50 p-6 rounded-xl border border-zinc-800/50 w-full lg:w-auto">
              {/* Tasa de Mitigación (Verde) */}
              <div className="text-center sm:text-right sm:border-r sm:border-zinc-800 sm:pr-8 w-full sm:w-auto">
                <p className="text-green-500/70 text-[10px] uppercase font-bold tracking-widest mb-1">Tasa de Mitigación</p>
                <p className="text-3xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">{porcentajeCompensado}%</p>
                <p className="text-zinc-500 text-[10px] uppercase mt-1">De Emisiones Brutas</p>
              </div>
              
              {/* Deuda Ambiental (Naranja/Rojo Llamativo) */}
              <div className="text-center sm:text-left sm:pl-2 w-full sm:w-auto">
                <p className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${alertColorClass.split(' ')[0]}`}>Deuda Ambiental</p>
                <p className={`text-4xl font-black ${alertColorClass}`}>{arbolesNecesarios.toLocaleString('es-EC')}</p>
                <p className="text-zinc-500 text-[10px] uppercase mt-1">Árboles Requeridos</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: AUDITORÍA LOGÍSTICA (CUADRÍCULA RESPONSIVE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <div className="bg-zinc-900 p-6 rounded-xl border border-red-900/40 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-red-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Actividad Crítica</p>
            <h2 className="text-xl font-bold text-white truncate relative z-10" title={topActividad.nombre}>{topActividad.nombre}</h2>
            <p className="text-red-400 text-sm font-bold mt-1 relative z-10 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]">
              {topActividad.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e
            </p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-orange-900/40 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-orange-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Vehículo Mayor Impacto</p>
            <h2 className="text-xl font-bold text-white tracking-widest relative z-10">{topVehiculo.placa}</h2>
            <p className="text-orange-400 text-sm font-bold mt-1 relative z-10 drop-shadow-[0_0_8px_rgba(251,146,60,0.4)]">
              {topVehiculo.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e
            </p>
          </div>

          <div className="bg-zinc-900 p-5 rounded-xl border border-indigo-900/40 shadow-xl relative overflow-hidden sm:col-span-2 lg:col-span-1">
            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-indigo-400/80 text-xs uppercase font-bold tracking-wider mb-3 relative z-10">Impacto por Sede Operativa</p>
            <div className="space-y-2 overflow-y-auto max-h-24 pr-2 custom-scrollbar relative z-10">
              {Object.entries(facilityData).map(([facility, cantidad]) => (
                <div key={facility} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1">
                  <span className="text-zinc-300 font-medium">{facility}</span>
                  <span className="font-mono text-indigo-400">
                    {cantidad.toLocaleString('es-EC', { maximumFractionDigits: 0 })} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: GRÁFICOS INTERACTIVOS (YA RESPONSIVE INTERNAMENTE) */}
        <DashboardClient rawData={rawData} />

        {/* ========================================== */}
        {/* FOOTER PROFESIONAL DE CRÉDITOS */}
        {/* ========================================== */}
        <footer className="mt-12 pt-8 border-t border-zinc-800/50 text-center pb-6">
          <a 
            href="https://kcdev420.github.io/CV/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-yellow-500 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <span>Design & Development by Kevin Mora © 2026</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </a>
        </footer>

      </main>
    );
  } catch (e) {
    console.error(e);
    return <div className="text-red-500 p-10 bg-black min-h-screen">Error de conexión: {e.message}</div>;
  }
}