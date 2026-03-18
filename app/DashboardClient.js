"use client";
import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect } from 'react';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-zinc-900/50 text-yellow-500 font-mono text-sm animate-pulse border border-zinc-800 rounded-2xl">
      Calibrando Instrumentos de Telemetría...
    </div>
  )
});

export default function DashboardClient({ rawData }) {
  const [isMobile, setIsMobile] = useState(false);

  // ==========================================
  // ESTADOS DE FILTRADO MÚLTIPLE (AHORA SON 3)
  // ==========================================
  const [activeScopes, setActiveScopes] = useState([]);
  const [activeFacilities, setActiveFacilities] = useState([]);
  const [activeActivities, setActiveActivities] = useState([]); // NUEVO FILTRO

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Funciones Toggle
  const toggleScope = (scopeNum) => setActiveScopes(prev => prev.includes(scopeNum) ? prev.filter(s => s !== scopeNum) : [...prev, scopeNum]);
  const toggleFacility = (facility) => setActiveFacilities(prev => prev.includes(facility) ? prev.filter(f => f !== facility) : [...prev, facility]);
  const toggleActivity = (act) => setActiveActivities(prev => prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act]); // NUEVO

  // Listas estáticas para la UI
  const allFacilitiesList = useMemo(() => Array.from(new Set(rawData.map(d => d.facility?.toUpperCase() || 'GENERAL'))).filter(f => f !== 'N/A'), [rawData]);
  const allActivitiesList = useMemo(() => Array.from(new Set(rawData.map(d => d.activity_type || 'Desconocida'))).filter(a => a !== 'N/A'), [rawData]); // NUEVO

  // MEGA-MOTOR DE CÁLCULO LOGÍSTICO COMPLETO
  const metrics = useMemo(() => {
    // 1. FILTRAR DATOS EN LAS 3 DIMENSIONES
    const filteredData = rawData.filter(item => {
      let match = true;
      if (activeScopes.length > 0 && !activeScopes.includes(Number(item.scope))) match = false;
      
      const fac = item.facility?.toUpperCase() || 'GENERAL';
      if (activeFacilities.length > 0 && !activeFacilities.includes(fac)) match = false;
      
      const act = item.activity_type || 'Desconocida';
      if (activeActivities.length > 0 && !activeActivities.includes(act)) match = false;
      
      return match;
    });

    let huellaNeta = 0;
    let emisionesEvitadas = 0;
    const scopeData = { 1: 0, 2: 0, 3: 0 };
    const activityData = {};
    const vehiculosData = {};
    const facilityData = {};

    const locations = {
      'GYE': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil' }, 'GUAYAQUIL': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil' },
      'UIO': { lat: -0.1807, lon: -78.4678, name: 'Quito' }, 'UIO12': { lat: -0.2000, lon: -78.5000, name: 'Quito Centro' }, 'QUITO': { lat: -0.1807, lon: -78.4678, name: 'Quito' },
      'CUE': { lat: -2.9001, lon: -79.0059, name: 'Cuenca' }, 'CUENCA': { lat: -2.9001, lon: -79.0059, name: 'Cuenca' },
      'PVO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo' }, 'PORTOVIEJO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo' }
    };

    const mapPoints = {};
    const scatter3D = { x: [], y: [], z: [], text: [], color: [] };
    const groups = {};
    const connectionLines = [];
    const timeline = {}; 

    [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
      const esReciclaje = item.activity_type && item.activity_type.toLowerCase().includes('reciclaje');
      let co2 = Number(item.co2e_kg) || 0;

      // Paneles solares o reciclaje (impactos negativos)
      if (co2 < 0 || esReciclaje) {
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

      const facility = item.facility?.toUpperCase() || 'GENERAL';
      if (!facilityData[facility]) facilityData[facility] = 0;
      facilityData[facility] += co2;

      if (co2 !== 0) {
        const dateStr = item.date || 'N/A';
        const scopeLabel = `Scope ${item.scope || 3}`;
        const dateObj = new Date(dateStr);
        const monthYear = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : 'Sin Fecha';

        if (!timeline[monthYear]) timeline[monthYear] = { emision: 0, compensacion: 0 };
        if (co2 > 0) timeline[monthYear].emision += co2;
        else timeline[monthYear].compensacion += co2;

        if (locations[facility]) {
          if (!mapPoints[facility]) mapPoints[facility] = { ...locations[facility], co2: 0 };
          mapPoints[facility].co2 += co2;
        }

        scatter3D.x.push(dateStr);
        scatter3D.y.push(actividad);
        scatter3D.z.push(co2);
        scatter3D.text.push(`<b>📍 Sede:</b> ${facility}<br><b>⚙️ Actividad:</b> ${actividad}<br><b>📊 Categoría:</b> ${scopeLabel}<br><b>☁️ Impacto:</b> ${co2.toLocaleString('es-EC')} kg CO2e`);
        scatter3D.color.push(co2);

        const groupKey = `${facility}-${actividad}-${scopeLabel}`;
        if (!groups[groupKey]) groups[groupKey] = { x: [], y: [], z: [] };
        groups[groupKey].x.push(dateStr);
        groups[groupKey].y.push(actividad);
        groups[groupKey].z.push(co2);
      }
    });

    Object.values(groups).forEach(g => {
      if (g.x.length > 1) {
        connectionLines.push({ type: 'scatter3d', mode: 'lines', x: g.x, y: g.y, z: g.z, line: { color: g.z[0] < 0 ? '#22c55e' : '#22d3ee', width: 2, dash: 'dot' }, hoverinfo: 'none', showlegend: false });
      }
    });

    let topActividad = { nombre: '-', cantidad: -Infinity };
    for (const [nombre, cantidad] of Object.entries(activityData)) {
      if (cantidad > topActividad.cantidad && cantidad > 0) topActividad = { nombre, cantidad };
    }
    if (topActividad.cantidad === -Infinity) topActividad = { nombre: 'N/A', cantidad: 0 };

    let topVehiculo = { placa: 'N/A', cantidad: 0 };
    for (const [placa, cantidad] of Object.entries(vehiculosData)) {
      if (cantidad > topVehiculo.cantidad) topVehiculo = { placa, cantidad };
    }

    const arbolesNecesarios = Math.max(0, Math.ceil(huellaNeta / 22));
    const totalBruto = huellaNeta + emisionesEvitadas;
    const porcentajeCompensado = totalBruto > 0 ? ((emisionesEvitadas / totalBruto) * 100).toFixed(2) : 0;
    const alertColorClass = huellaNeta > 1000 ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]";

    const sortedTimelineKeys = Object.keys(timeline).sort();
    const trendFormatted = { labels: sortedTimelineKeys, emisiones: sortedTimelineKeys.map(k => timeline[k].emision), compensaciones: sortedTimelineKeys.map(k => timeline[k].compensacion) };

    const mapDataArray = Object.values(mapPoints);
    const maxMapCo2 = Math.max(...mapDataArray.map(m => Math.abs(m.co2)), 1);
    mapDataArray.forEach(d => {
      d.markerSize = 10 + ((Math.abs(d.co2) / maxMapCo2) * 35);
      d.markerColor = d.co2 < 0 ? '#22c55e' : '#eab308';
      d.hoverText = `<b>${d.name}</b><br>Impacto Neto: ${d.co2.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e`;
    });

    return { 
      huellaNeta, emisionesEvitadas, scopeData, facilityData, activityData, topActividad, topVehiculo, arbolesNecesarios, porcentajeCompensado, alertColorClass,
      mapData: mapDataArray, trace3D: scatter3D, lines3D: connectionLines, 
      donutData: { labels: ['Scope 1', 'Scope 2', 'Scope 3'], values: [scopeData[1]||0, scopeData[2]||0, scopeData[3]||0] }, 
      barData: { labels: Object.keys(activityData), values: Object.values(activityData) },
      trendData: trendFormatted
    };
  }, [rawData, activeScopes, activeFacilities, activeActivities]);

  const mapLayout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 0, b: 0, l: 0, r: 0 }, geo: { scope: 'south america', showland: true, landcolor: '#18181b', showocean: true, oceancolor: '#09090b', showlakes: true, lakecolor: '#09090b', showcountries: true, countrycolor: '#3f3f46', center: { lat: -1.1312, lon: -79.1834 }, projection: { type: 'mercator', scale: isMobile ? 12 : 15 } } };
  const layout3D = { paper_bgcolor: 'transparent', margin: { t: 0, b: 0, l: 0, r: 0 }, showlegend: false, scene: { xaxis: { title: { text: 'FECHA', font: { color: '#22d3ee', size: 10 } }, color: '#a1a1aa', tickfont: {size: 9}, tickangle: 45 }, yaxis: { title: { text: 'ACTIVIDAD', font: { color: '#22d3ee', size: 10 } }, color: '#a1a1aa', tickfont: {size: 9} }, zaxis: { title: { text: 'HUELLA (kg)', font: { color: '#22d3ee', size: 10 } }, color: '#a1a1aa', tickfont: {size: 9} }, camera: { eye: isMobile ? { x: 2.2, y: 2.2, z: 1.2 } : { x: 2.0, y: 2.0, z: 1.1 } }, aspectratio: { x: 1.2, y: 1.2, z: 0.8 } } };
  const layoutDonut = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 20, b: 20, l: 20, r: 20 }, showlegend: true, font: { color: '#a1a1aa' }, legend: { orientation: 'h', y: -0.1 } };
  const layoutBar = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 10, b: 40, l: 140, r: 20 }, xaxis: { color: '#a1a1aa' }, yaxis: { color: '#a1a1aa', tickfont: {size: 11} } };
  const layoutTrend = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 20, b: 40, l: 40, r: 20 }, font: { color: '#a1a1aa' }, barmode: 'relative', showlegend: true, legend: { orientation: 'h', y: 1.1 }, xaxis: { gridcolor: '#27272a' }, yaxis: { gridcolor: '#27272a' } };

  return (
    <>
      {/* BOTÓN LIMPIAR TODOS LOS FILTROS */}
      {(activeScopes.length > 0 || activeFacilities.length > 0 || activeActivities.length > 0) && (
        <div className="flex justify-end mb-4 animate-fade-in">
          <button onClick={() => { setActiveScopes([]); setActiveFacilities([]); setActiveActivities([]); }} className="bg-red-500/20 text-red-500 border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500/40 transition-all flex items-center gap-2">
            <span>✖</span> ELIMINAR FILTROS ({activeScopes.length + activeFacilities.length + activeActivities.length})
          </button>
        </div>
      )}

      {/* SECCIÓN 1: KPIs GLOBALES Y SCOPE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-zinc-900 p-6 rounded-xl border border-yellow-900/30 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-yellow-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Huella Neta Filtrada</p>
          <h2 className="text-3xl md:text-4xl font-black text-white relative z-10 drop-shadow-md">
            {metrics.huellaNeta.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">kg CO2e</span>
          </h2>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-green-900/50 shadow-xl relative overflow-hidden">
           <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/15 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-green-500 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Emisiones Evitadas</p>
          <h2 className="text-3xl md:text-4xl font-black text-green-400 relative z-10 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
            -{metrics.emisionesEvitadas.toLocaleString('es-EC', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">kg</span>
          </h2>
        </div>

        <div className="bg-zinc-900 p-5 rounded-xl border border-blue-900/30 shadow-xl relative overflow-hidden flex flex-col justify-center sm:col-span-2 lg:col-span-1">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-blue-400/80 text-xs uppercase font-bold tracking-wider mb-3 relative z-10 flex justify-between items-center">
            Filtro Scope <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Múltiple</span>
          </p>
          <div className="space-y-2 relative z-10">
            {[1, 2, 3].map((scopeNum) => {
              const isActive = activeScopes.includes(scopeNum);
              return (
                <div key={scopeNum} onClick={() => toggleScope(scopeNum)} className={`flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1 cursor-pointer rounded px-2 transition-all ${isActive ? 'bg-blue-500/30 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'hover:bg-zinc-800'}`}>
                  <span className={isActive ? 'text-white font-bold flex items-center gap-2' : 'text-zinc-400'}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>} Scope {scopeNum}
                  </span>
                  <span className={`font-mono ${isActive ? 'text-white font-bold' : 'text-blue-400/50'}`}>
                    {(metrics.scopeData[scopeNum] || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })} kg
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: EQUIVALENCIA ECOLÓGICA */}
      <div className="mb-10 bg-gradient-to-r from-zinc-900 to-[#0a0a0a] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden relative">
        <div className={`absolute right-0 top-0 w-96 h-full ${metrics.huellaNeta > 1000 ? 'bg-red-500/10' : 'bg-green-500/10'} blur-3xl rounded-full pointer-events-none`}></div>
        <div className="p-6 md:p-8 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center lg:text-left">
            <h3 className={`text-sm font-bold uppercase tracking-widest mb-2 flex items-center justify-center lg:justify-start gap-2 ${metrics.alertColorClass}`}><span>🌱</span> Impacto de la Selección Actual</h3>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl mx-auto lg:mx-0">Para neutralizar la Huella de Carbono de los filtros actuales de UPS Healthcare, se requeriría la plantación y mantenimiento de un bosque a escala durante un año completo.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center bg-black/50 p-6 rounded-xl border border-zinc-800/50 w-full lg:w-auto">
            <div className="text-center sm:text-right sm:border-r sm:border-zinc-800 sm:pr-8 w-full sm:w-auto">
              <p className="text-green-500/70 text-[10px] uppercase font-bold tracking-widest mb-1">Tasa de Mitigación</p>
              <p className="text-3xl font-black text-green-400">{metrics.porcentajeCompensado}%</p>
            </div>
            <div className="text-center sm:text-left sm:pl-2 w-full sm:w-auto">
              <p className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${metrics.alertColorClass.split(' ')[0]}`}>Deuda Ambiental</p>
              <p className={`text-4xl font-black ${metrics.alertColorClass}`}>{metrics.arbolesNecesarios.toLocaleString('es-EC')}</p>
              <p className="text-zinc-500 text-[10px] uppercase mt-1">Árboles Requeridos</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: AUDITORÍA Y FILTROS SECUNDARIOS (4 COLUMNAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        <div className="bg-zinc-900 p-6 rounded-xl border border-red-900/40 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-red-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Top Actividad</p>
          <h2 className="text-xl font-bold text-white truncate relative z-10" title={metrics.topActividad.nombre}>{metrics.topActividad.nombre}</h2>
          <p className="text-red-400 text-sm font-bold mt-1 relative z-10 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]">{metrics.topActividad.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg</p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-orange-900/40 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-orange-500/80 text-xs uppercase font-bold tracking-wider mb-2 relative z-10">Top Vehículo</p>
          <h2 className="text-xl font-bold text-white tracking-widest relative z-10">{metrics.topVehiculo.placa}</h2>
          <p className="text-orange-400 text-sm font-bold mt-1 relative z-10 drop-shadow-[0_0_8px_rgba(251,146,60,0.4)]">{metrics.topVehiculo.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg</p>
        </div>

        {/* FILTRO: SEDES (ÍNDIGO) */}
        <div className="bg-zinc-900 p-5 rounded-xl border border-indigo-900/40 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-indigo-400/80 text-xs uppercase font-bold tracking-wider mb-3 relative z-10 flex justify-between items-center">
            Filtro Sede <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">Múltiple</span>
          </p>
          <div className="space-y-2 overflow-y-auto max-h-24 pr-2 custom-scrollbar relative z-10">
            {allFacilitiesList.map((facility) => {
              const isActive = activeFacilities.includes(facility);
              const cantidadLocal = metrics.facilityData[facility] || 0;
              return (
                <div key={facility} onClick={() => toggleFacility(facility)} className={`flex justify-between items-center text-sm border-b border-zinc-800/50 pb-1 cursor-pointer rounded px-2 transition-all ${isActive ? 'bg-indigo-500/30 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'hover:bg-zinc-800'}`}>
                  <span className={isActive ? 'text-white font-bold flex items-center gap-2' : 'text-zinc-300 font-medium'}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>} {facility}
                  </span>
                  <span className={`font-mono ${isActive ? 'text-white font-bold' : 'text-indigo-400/50'}`}>
                    {cantidadLocal.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* NUEVO FILTRO: ACTIVIDADES (PÚRPURA) */}
        <div className="bg-zinc-900 p-5 rounded-xl border border-purple-900/40 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-purple-400/80 text-xs uppercase font-bold tracking-wider mb-3 relative z-10 flex justify-between items-center">
            Filtro Actividad <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">Múltiple</span>
          </p>
          <div className="space-y-2 overflow-y-auto max-h-24 pr-2 custom-scrollbar relative z-10">
            {allActivitiesList.map((act) => {
              const isActive = activeActivities.includes(act);
              const cantidadLocal = metrics.activityData[act] || 0;
              return (
                <div key={act} onClick={() => toggleActivity(act)} className={`flex justify-between items-center text-xs border-b border-zinc-800/50 pb-1 cursor-pointer rounded px-2 transition-all ${isActive ? 'bg-purple-500/30 border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'hover:bg-zinc-800'}`}>
                  <span className={isActive ? 'text-white font-bold flex items-center gap-2 truncate w-2/3' : 'text-zinc-300 font-medium truncate w-2/3'} title={act}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>} {act}
                  </span>
                  <span className={`font-mono ${isActive ? 'text-white font-bold' : 'text-purple-400/50'}`}>
                    {cantidadLocal.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* SECCIÓN 4: GRÁFICOS INTERACTIVOS (Ya conectados a los 3 filtros) */}
      <div className="flex flex-col gap-6 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-yellow-900/30 shadow-xl overflow-hidden h-[450px] relative">
            <h3 className="text-yellow-500/90 text-xs font-bold uppercase mb-2 flex items-center gap-2 relative z-10"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Radar Logístico</h3>
            <div className="h-full w-full relative z-10"><Plot data={[{ type: 'scattergeo', lat: metrics.mapData.map(d=>d.lat), lon: metrics.mapData.map(d=>d.lon), text: metrics.mapData.map(d=>d.hoverText), hoverinfo: 'text', marker: { size: metrics.mapData.map(d=>d.markerSize), color: metrics.mapData.map(d=>d.markerColor), line: {width: 1, color: '#18181b'}, opacity: 0.9 } }]} layout={mapLayout} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} /></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-cyan-900/40 shadow-xl overflow-hidden h-[450px] relative">
            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Matriz Evolutiva 3D</h3>
            <div className="h-full w-full cursor-move relative z-10"><Plot data={[{ type: 'scatter3d', mode: 'markers', x: metrics.trace3D.x, y: metrics.trace3D.y, z: metrics.trace3D.z, text: metrics.trace3D.text, hoverinfo: 'text', marker: { size: 6, color: metrics.trace3D.color, colorscale: 'PuBu', opacity: 0.8 } }, ...metrics.lines3D]} layout={layout3D} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true }} /></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-cyan-900/40 shadow-xl overflow-hidden h-[350px] relative">
          <h3 className="text-cyan-400 text-xs font-bold uppercase mb-2 relative z-10">Flujo Neto Mensual</h3>
          <div className="h-full w-full relative z-10"><Plot data={[{ type: 'bar', x: metrics.trendData.labels, y: metrics.trendData.emisiones, name: 'Emisiones Brutas (kg)', marker: { color: '#ef4444' } }, { type: 'bar', x: metrics.trendData.labels, y: metrics.trendData.compensaciones, name: 'Reciclaje / Mitigación (kg)', marker: { color: '#22c55e' } }]} layout={layoutTrend} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-orange-900/30 shadow-xl overflow-hidden h-[350px] relative">
            <h3 className="text-orange-400 text-xs font-bold uppercase mb-2 relative z-10">Proporción por Scope</h3>
            <div className="h-full w-full relative z-10"><Plot data={[{ type: 'pie', hole: 0.6, labels: metrics.donutData.labels, values: metrics.donutData.values, marker: { colors: ['#eab308', '#f97316', '#ef4444'] }, hoverinfo: 'label+percent+value' }]} layout={layoutDonut} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} /></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-emerald-900/30 shadow-xl overflow-hidden h-[350px] relative">
            <h3 className="text-emerald-400 text-xs font-bold uppercase mb-2 relative z-10">Impacto Absoluto por Actividad</h3>
            <div className="h-full w-full relative z-10"><Plot data={[{ type: 'bar', orientation: 'h', y: metrics.barData.labels, x: metrics.barData.values, hoverinfo: 'x+y', marker: { color: metrics.barData.values.map(v => v < 0 ? '#22c55e' : '#eab308') } }]} layout={layoutBar} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} /></div>
          </div>
        </div>
      </div>
    </>
  );
}