import clientPromise from "../lib/mongodb";
import DashboardClient from "./DashboardClient"; 

export default async function Home() {
  try {
    const client = await clientPromise;
    const db = client.db("carbono"); 
    
    // Extracción limpia de base de datos
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

    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
        
        {/* ENCABEZADO LIMPIO */}
        <header className="flex justify-between items-center border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-yellow-500">UPS HEALTHCARE</h1>
            <p className="text-zinc-400 text-sm italic mt-1">Plataforma de Inteligencia Ambiental</p>
          </div>
          <div className="flex gap-4">
            <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              API & ATLAS CONNECTED
            </span>
          </div>
        </header>

        {/* SECCIÓN 1: KPIs FINANCIEROS Y DE IMPACTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl">
            <p className="text-zinc-500 text-xs uppercase font-semibold mb-2">Huella de Carbono Neta</p>
            <h2 className="text-4xl font-black text-white">
              {huellaNeta.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">kg CO2e</span>
            </h2>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-green-900/50 shadow-xl relative overflow-hidden">
             <div className="absolute right-0 top-0 w-16 h-16 bg-green-500/10 rounded-full blur-xl"></div>
            <p className="text-green-500 text-xs uppercase font-semibold mb-2">Emisiones Evitadas (Reciclaje)</p>
            <h2 className="text-4xl font-black text-green-400">
              -{emisionesEvitadas.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-green-500/50">kg CO2e</span>
            </h2>
          </div>

          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-xl flex flex-col justify-center">
            <p className="text-zinc-500 text-xs uppercase font-semibold mb-3">Distribución por Scope</p>
            <div className="space-y-2">
              {[1, 2, 3].map((scopeNum) => (
                <div key={scopeNum} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1">
                  <span className="text-zinc-400">Scope {scopeNum}</span>
                  <span className="font-mono font-bold text-yellow-500">
                    {(scopeData[scopeNum] || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: AUDITORÍA LOGÍSTICA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-zinc-900 p-6 rounded-xl border border-red-900/30 shadow-xl">
            <p className="text-red-400 text-xs uppercase font-semibold mb-2">Actividad Crítica</p>
            <h2 className="text-xl font-bold text-white truncate" title={topActividad.nombre}>{topActividad.nombre}</h2>
            <p className="text-red-400 text-sm font-bold mt-1">
              {topActividad.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e
            </p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-orange-900/30 shadow-xl">
            <p className="text-orange-400 text-xs uppercase font-semibold mb-2">Vehículo Mayor Impacto</p>
            <h2 className="text-xl font-bold text-white tracking-widest">{topVehiculo.placa}</h2>
            <p className="text-orange-400 text-sm font-bold mt-1">
              {topVehiculo.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e
            </p>
          </div>

          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-xl">
            <p className="text-zinc-500 text-xs uppercase font-semibold mb-3">Impacto por Facility</p>
            <div className="space-y-2 overflow-y-auto max-h-24 pr-2 custom-scrollbar">
              {Object.entries(facilityData).map(([facility, cantidad]) => (
                <div key={facility} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1">
                  <span className="text-zinc-300 font-medium">{facility}</span>
                  <span className="font-mono text-zinc-400">
                    {cantidad.toLocaleString('es-EC', { maximumFractionDigits: 0 })} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: LOS GRÁFICOS INTERACTIVOS */}
        <DashboardClient rawData={rawData} />

        {/* SECCIÓN 4: VISTA PREVIA DE DATOS (Auditoría) */}
        <div className="mt-10 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-zinc-800/50 flex justify-between items-center">
            <h3 className="font-bold text-sm text-zinc-300">Registro de Ingestión (Datos Crudos)</h3>
            <span className="text-xs text-zinc-500">Total en BD: {rawData.length} operaciones</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-[11px] text-zinc-400 leading-relaxed font-mono">
              {JSON.stringify(rawData.slice(0, 3), null, 2)}
            </pre>
          </div>
        </div>

      </main>
    );
  } catch (e) {
    console.error(e);
    return <div className="text-red-500 p-10 bg-black min-h-screen">Error de conexión: {e.message}</div>;
  }
}