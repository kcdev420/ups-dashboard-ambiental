"use client";
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Importación Dinámica de Plotly
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function DashboardClient({ rawData }) {
  
  // ==========================================
  // PROCESAMIENTO ETL BLINDADO Y AMPLIADO
  // ==========================================
  const { mapData, tracePuntos, traceLineas, donutData, barData } = useMemo(() => {
    
    // 1. DICCIONARIO GPS
    const locations = {
      'GYE': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil (GYE)', co2: 0, hasData: false },
      'GUAYAQUIL': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil', co2: 0, hasData: false },
      'UIO': { lat: -0.1807, lon: -78.4678, name: 'Quito (UIO)', co2: 0, hasData: false },
      'UIO12': { lat: -0.2000, lon: -78.5000, name: 'Quito Centro (UIO12)', co2: 0, hasData: false },
      'QUITO': { lat: -0.1807, lon: -78.4678, name: 'Quito', co2: 0, hasData: false },
      'CUE': { lat: -2.9001, lon: -79.0059, name: 'Cuenca (CUE)', co2: 0, hasData: false },
      'CUENCA': { lat: -2.9001, lon: -79.0059, name: 'Cuenca', co2: 0, hasData: false },
      'PVO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo (PVO)', co2: 0, hasData: false },
      'PORTOVIEJO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo', co2: 0, hasData: false }
    };

    const acortarFecha = (str) => {
      if (!str) return 'N/A';
      const s = String(str);
      if (s.length > 5 && s.includes('-')) return s.slice(5); 
      return s.slice(0, 3).toUpperCase(); 
    };

    // Variables Maestras 3D
    const marcadores = { fechas: [], actividades: [], co2: [], textos: [] };
    const gruposLineas = {};
    let maxAbs = 1;

    // Variables Maestras 2D (NUEVO)
    const scopeTotals = {};
    const activityTotals = {};

    rawData.forEach(item => {
      let co2 = Number(item.co2e_kg) || 0;
      const isReciclaje = item.activity_type?.toLowerCase().includes('reciclaje');
      if (isReciclaje) co2 = -Math.abs(co2); 

      if (co2 !== 0) {
        
        // Calcular el máximo histórico para el Semáforo
        maxAbs = Math.max(maxAbs, Math.abs(co2));

        // Asignación de mapa 
        const fac = item.facility ? item.facility.toUpperCase() : null;
        if (fac && locations[fac]) {
          locations[fac].co2 += co2;
          locations[fac].hasData = true; 
        }

        // Procesamiento 3D
        const fechaCorta = acortarFecha(item.mes_referencia || item.date);
        const actividad = item.activity_type || 'N/A';
        const sede = item.facility || 'General';
        const scopeLabel = `Scope ${item.scope || 3}`;

        // Llenamos la Capa Maestra
        marcadores.fechas.push(fechaCorta);
        marcadores.actividades.push(actividad);
        marcadores.co2.push(co2);
        marcadores.textos.push(`Sede: ${sede}<br>Detalle: ${item.placa_vehiculo || 'N/A'}`);

        // Agrupamos para trazar las líneas lógicas
        const llaveGrupo = `${actividad} | ${scopeLabel} | ${sede}`;
        if (!gruposLineas[llaveGrupo]) {
          gruposLineas[llaveGrupo] = { fechas: [], actividades: [], co2: [] };
        }
        gruposLineas[llaveGrupo].fechas.push(fechaCorta);
        gruposLineas[llaveGrupo].actividades.push(actividad);
        gruposLineas[llaveGrupo].co2.push(co2);

        // --- LÓGICA 2D (NUEVO) ---
        // 1. Donut de Scopes (Solo sumamos los que contaminan, > 0)
        if (co2 > 0) {
          scopeTotals[scopeLabel] = (scopeTotals[scopeLabel] || 0) + co2;
        }
        // 2. Barras de Actividad (Sumamos Netos, positivos y negativos)
        activityTotals[actividad] = (activityTotals[actividad] || 0) + co2;
      }
    });

    // 1. TRAZO MAESTRO 3D
    const trazoPrincipal = {
      type: 'scatter3d',
      mode: 'markers',
      name: 'Operaciones',
      x: marcadores.fechas,
      y: marcadores.actividades,
      z: marcadores.co2,
      text: marcadores.textos,
      hoverinfo: 'text+z',
      marker: {
        size: 8,
        color: marcadores.co2,
        colorscale: [ [0, '#22c55e'], [0.5, '#eab308'], [1, '#ef4444'] ],
        cmin: -maxAbs,
        cmax: maxAbs,
        showscale: true,
        colorbar: { title: 'kg CO2e', tickfont: { color: '#a1a1aa' }, titlefont: { color: '#a1a1aa' } }
      }
    };

    // 2. LÍNEAS DE CONEXIÓN 3D
    const trazosConexion = Object.values(gruposLineas)
      .filter(grupo => grupo.co2.length > 1)
      .map(grupo => ({
        type: 'scatter3d',
        mode: 'lines',
        x: grupo.fechas,
        y: grupo.actividades,
        z: grupo.co2,
        hoverinfo: 'none',
        showlegend: false,
        line: { color: grupo.co2[0] < 0 ? '#4ade80' : '#7f1d1d', width: 3 }
      }));

    return {
      mapData: Object.values(locations).filter(l => l.hasData),
      tracePuntos: trazoPrincipal,
      traceLineas: trazosConexion,
      donutData: { labels: Object.keys(scopeTotals), values: Object.values(scopeTotals) },
      barData: { labels: Object.keys(activityTotals), values: Object.values(activityTotals) }
    };
  }, [rawData]);

  // ==========================================
  // CONFIGURACIÓN DE PANTALLA (Layouts)
  // ==========================================

  // --- MAPA ---
  const traceMap = {
    type: 'scattergeo',
    lat: mapData.map(d => d.lat),
    lon: mapData.map(d => d.lon),
    text: mapData.map(d => `<b>${d.name}</b><br>Impacto Neto: ${d.co2.toFixed(1)} kg CO2e`),
    hoverinfo: 'text',
    marker: {
      size: mapData.map(d => Math.min(Math.max((Math.abs(d.co2) / 500), 10), 30)), 
      color: mapData.map(d => d.co2 < 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(234, 179, 8, 0.7)'),
      line: { color: mapData.map(d => d.co2 < 0 ? '#22c55e' : '#eab308'), width: 2 }
    }
  };

  const layoutMap = {
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 0, b: 0, l: 0, r: 0 },
    geo: { scope: 'south america', resolution: 50, showland: true, landcolor: '#18181b', showocean: true, oceancolor: '#09090b', showcountries: true, countrycolor: '#3f3f46', center: { lat: -1.4, lon: -79.0 }, projection: { type: 'mercator', scale: 4.5 } }
  };

  // --- 3D ---
  const layout3D = {
    paper_bgcolor: 'transparent', margin: { t: 0, b: 0, l: 0, r: 0 }, showlegend: false,
    scene: {
      xaxis: { title: { text: 'Fecha' }, tickfont: { size: 10 }, color: '#a1a1aa', gridcolor: '#27272a' },
      yaxis: { title: { text: 'Actividad' }, tickfont: { size: 10 }, color: '#a1a1aa', gridcolor: '#27272a' },
      zaxis: { title: { text: 'Huella Neta' }, tickfont: { size: 10 }, color: '#a1a1aa', gridcolor: '#27272a' },
      camera: { eye: { x: 1.6, y: 1.6, z: 1.0 } }
    }
  };

  // --- NUEVO: GRÁFICO DONUT (SCOPE) ---
  const traceDonut = {
    type: 'pie', hole: 0.6,
    labels: donutData.labels, values: donutData.values,
    hoverinfo: 'label+percent+value',
    textinfo: 'percent',
    marker: { colors: ['#eab308', '#f97316', '#ef4444', '#3b82f6'], line: { color: '#18181b', width: 2 } }
  };
  const layoutDonut = {
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 20, b: 20, l: 20, r: 20 },
    showlegend: true, font: { color: '#a1a1aa' },
    legend: { orientation: 'h', y: -0.1 }
  };

  // --- NUEVO: GRÁFICO DE BARRAS (ACTIVIDADES) ---
  const traceBar = {
    type: 'bar', orientation: 'h',
    y: barData.labels, x: barData.values,
    text: barData.values.map(v => `${v.toFixed(1)} kg`), textposition: 'auto',
    marker: { 
      color: barData.values.map(v => v < 0 ? '#22c55e' : '#eab308'), // Verde si es negativo, Amarillo corporativo si es positivo
      line: { color: barData.values.map(v => v < 0 ? '#166534' : '#854d0e'), width: 1 } 
    }
  };
  const layoutBar = {
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 10, b: 40, l: 120, r: 20 },
    xaxis: { title: 'Impacto Neto (kg CO2e)', color: '#a1a1aa', gridcolor: '#27272a', zerolinecolor: '#52525b' },
    yaxis: { color: '#a1a1aa' }
  };

  return (
    <div className="flex flex-col gap-6 mt-8">
      
      {/* FILA 1: MAPA Y 3D (Se mantienen intactos) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
          <h3 className="text-zinc-400 text-xs uppercase font-bold mb-2 tracking-wider">Radar Logístico Ecuador</h3>
          <p className="text-zinc-600 text-[10px] mb-4">Zoom adaptativo a sedes activas</p>
          <div className="h-96 w-full relative">
            <Plot data={[traceMap]} layout={layoutMap} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
          <h3 className="text-zinc-400 text-xs uppercase font-bold mb-2 tracking-wider">Cubo Evolutivo 3D</h3>
          <p className="text-zinc-600 text-[10px] mb-4">Gira para explorar. Líneas conectan misma operación en el tiempo.</p>
          <div className="h-96 w-full cursor-move relative">
            <Plot data={[tracePuntos, ...traceLineas]} layout={layout3D} config={{ responsive: true }} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* FILA 2: NUEVOS GRÁFICOS 2D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO DONUT: DISTRIBUCIÓN POR SCOPE */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
          <h3 className="text-zinc-400 text-xs uppercase font-bold mb-2 tracking-wider">Distribución por Alcance (Scope)</h3>
          <p className="text-zinc-600 text-[10px] mb-4">Porcentaje de emisiones brutas (excluye reciclaje)</p>
          <div className="h-72 w-full relative">
            <Plot data={[traceDonut]} layout={layoutDonut} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* GRÁFICO BARRAS: IMPACTO NETO POR ACTIVIDAD */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
          <h3 className="text-zinc-400 text-xs uppercase font-bold mb-2 tracking-wider">Balance Neto por Actividad</h3>
          <p className="text-zinc-600 text-[10px] mb-4">Emisiones operativas vs. Compensación ambiental</p>
          <div className="h-72 w-full relative">
            <Plot data={[traceBar]} layout={layoutBar} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

      </div>

    </div>
  );
}