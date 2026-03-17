"use client";
import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect } from 'react';

// Carga perezosa de Plotly para no asfixiar a tu PC
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { mapData, trace3D, lines3D, donutData, barData, trendData } = useMemo(() => {
    // 1. Diccionario GPS (Coordenadas de Ecuador)
    const locations = {
      'GYE': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil' },
      'GUAYAQUIL': { lat: -2.1962, lon: -79.8862, name: 'Guayaquil' },
      'UIO': { lat: -0.1807, lon: -78.4678, name: 'Quito' },
      'UIO12': { lat: -0.2000, lon: -78.5000, name: 'Quito Centro' },
      'QUITO': { lat: -0.1807, lon: -78.4678, name: 'Quito' },
      'CUE': { lat: -2.9001, lon: -79.0059, name: 'Cuenca' },
      'CUENCA': { lat: -2.9001, lon: -79.0059, name: 'Cuenca' },
      'PVO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo' },
      'PORTOVIEJO': { lat: -1.0546, lon: -80.4544, name: 'Portoviejo' }
    };

    const sortedData = [...rawData].sort((a, b) => new Date(a.date) - new Date(b.date));

    const mapPoints = {};
    const scatter3D = { x: [], y: [], z: [], text: [], color: [] };
    const groups = {};
    const connectionLines = [];
    
    const scopeTotals = {};
    const activityTotals = {};
    const timeline = {}; 

    sortedData.forEach(item => {
      let co2 = Number(item.co2e_kg) || 0;
      const isReciclaje = item.activity_type?.toLowerCase().includes('reciclaje');
      if (isReciclaje) co2 = -Math.abs(co2); 

      if (co2 !== 0) {
        const facility = item.facility?.toUpperCase() || 'GENERAL';
        const activity = item.activity_type || 'N/A';
        const dateStr = item.date || 'N/A';
        const scopeLabel = `Scope ${item.scope || 3}`;

        const dateObj = new Date(dateStr);
        const monthYear = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : 'Sin Fecha';

        if (!timeline[monthYear]) timeline[monthYear] = { emision: 0, compensacion: 0 };
        if (co2 > 0) timeline[monthYear].emision += co2;
        else timeline[monthYear].compensacion += co2;

        if (co2 > 0) scopeTotals[scopeLabel] = (scopeTotals[scopeLabel] || 0) + co2;
        activityTotals[activity] = (activityTotals[activity] || 0) + co2;

        if (locations[facility]) {
          if (!mapPoints[facility]) mapPoints[facility] = { ...locations[facility], co2: 0 };
          mapPoints[facility].co2 += co2;
        }

        scatter3D.x.push(dateStr);
        scatter3D.y.push(activity);
        scatter3D.z.push(co2);
        
        scatter3D.text.push(
          `<b>📍 Sede:</b> ${facility}<br>` +
          `<b>⚙️ Actividad:</b> ${activity}<br>` +
          `<b>📊 Categoría:</b> ${scopeLabel}<br>` +
          `<b>📅 Fecha:</b> ${dateStr}<br>` +
          `<b>☁️ Impacto:</b> ${co2.toLocaleString('es-EC')} kg CO2e`
        );
        scatter3D.color.push(co2);

        const groupKey = `${facility}-${activity}-${scopeLabel}`;
        if (!groups[groupKey]) groups[groupKey] = { x: [], y: [], z: [] };
        groups[groupKey].x.push(dateStr);
        groups[groupKey].y.push(activity);
        groups[groupKey].z.push(co2);
      }
    });

    Object.values(groups).forEach(g => {
      if (g.x.length > 1) {
        connectionLines.push({
          type: 'scatter3d', mode: 'lines',
          x: g.x, y: g.y, z: g.z,
          line: { color: g.z[0] < 0 ? '#22c55e' : '#22d3ee', width: 2, dash: 'dot' },
          hoverinfo: 'none', showlegend: false
        });
      }
    });

    const sortedTimelineKeys = Object.keys(timeline).sort();
    const trendFormatted = {
      labels: sortedTimelineKeys,
      emisiones: sortedTimelineKeys.map(k => timeline[k].emision),
      compensaciones: sortedTimelineKeys.map(k => timeline[k].compensacion)
    };

    const mapDataArray = Object.values(mapPoints);
    const maxMapCo2 = Math.max(...mapDataArray.map(m => Math.abs(m.co2)), 1);

    mapDataArray.forEach(d => {
      d.markerSize = 10 + ((Math.abs(d.co2) / maxMapCo2) * 35);
      d.markerColor = d.co2 < 0 ? '#22c55e' : '#eab308';
      d.hoverText = `<b>${d.name}</b><br>Impacto Neto: ${d.co2.toLocaleString('es-EC', { maximumFractionDigits: 1 })} kg CO2e`;
    });

    return { 
      mapData: mapDataArray, 
      trace3D: scatter3D, 
      lines3D: connectionLines,
      donutData: { labels: Object.keys(scopeTotals), values: Object.values(scopeTotals) },
      barData: { labels: Object.keys(activityTotals), values: Object.values(activityTotals) },
      trendData: trendFormatted
    };
  }, [rawData]);

  // ==========================================
  // CONFIGURACIÓN DE MAPA (ZOOM EN ECUADOR)
  // ==========================================
  const mapLayout = { 
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 0, b: 0, l: 0, r: 0 }, 
    geo: { 
      scope: 'south america', showland: true, landcolor: '#18181b', 
      showocean: true, oceancolor: '#09090b', showlakes: true, lakecolor: '#09090b',
      showcountries: true, countrycolor: '#3f3f46', 
      // Centro geográfico exacto y Zoom ajustado (22 para PC, 14 para Móviles)
      center: { lat: -1.1312, lon: -79.1834 }, projection: { type: 'mercator', scale: isMobile ? 12 : 15 } 
    } 
  };

  const layout3D = { 
    paper_bgcolor: 'transparent', 
    margin: { t: 0, b: 0, l: 0, r: 0 }, 
    showlegend: false, 
    scene: { 
      xaxis: { title: { text: 'FECHA REGISTRO', font: { color: '#22d3ee', size: 11 } }, color: '#a1a1aa', tickfont: {size: 10}, tickangle: 45 }, 
      yaxis: { title: { text: 'TIPO ACTIVIDAD', font: { color: '#22d3ee', size: 11 } }, color: '#a1a1aa', tickfont: {size: 10} }, 
      zaxis: { title: { text: 'HUELLA NETA (kg)', font: { color: '#22d3ee', size: 11 } }, color: '#a1a1aa', tickfont: {size: 10} }, 
      camera: { eye: isMobile ? { x: 2.2, y: 2.2, z: 1.2 } : { x: 2.0, y: 2.0, z: 1.1 } },
      aspectratio: { x: 1.2, y: 1.2, z: 0.8 } 
    } 
  };

  const layoutDonut = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 20, b: 20, l: 20, r: 20 }, showlegend: true, font: { color: '#a1a1aa' }, legend: { orientation: 'h', y: -0.1 } };
  const layoutBar = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 10, b: 40, l: 140, r: 20 }, xaxis: { color: '#a1a1aa' }, yaxis: { color: '#a1a1aa', tickfont: {size: 11} } };
  
  const layoutTrend = { 
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { t: 20, b: 40, l: 40, r: 20 }, 
    font: { color: '#a1a1aa' },
    barmode: 'relative', 
    showlegend: true, legend: { orientation: 'h', y: 1.1 },
    xaxis: { gridcolor: '#27272a' },
    yaxis: { gridcolor: '#27272a' }
  };

  return (
    <div className="flex flex-col gap-6 mt-2">
      
      {/* FILA 1: MAPA Y CUBO 3D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MAPA - THEME: YELLOW CON LEYENDA FLOTANTE */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-yellow-900/30 shadow-xl overflow-hidden h-[450px] relative">
          <div className="absolute right-0 top-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-yellow-500/90 text-xs font-bold uppercase mb-2 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Radar Logístico Ecuador
          </h3>
          
          <div className="h-full w-full relative z-10">
            <Plot data={[{ type: 'scattergeo', lat: mapData.map(d=>d.lat), lon: mapData.map(d=>d.lon), text: mapData.map(d=>d.hoverText), hoverinfo: 'text', marker: { size: mapData.map(d=>d.markerSize), color: mapData.map(d=>d.markerColor), line: {width: 1, color: '#18181b'}, opacity: 0.9 } }]} layout={mapLayout} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} />
          </div>

          {/* LEYENDA FLOTANTE (STORYTELLING) */}
          <div className="absolute bottom-6 left-6 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md z-20 pointer-events-none">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1">Leyenda de Impacto</p>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></span>
                <span className="text-[10px] text-zinc-300 font-medium">Emisión Neta (Crítica)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] text-zinc-300 font-medium">Mitigación / Reciclaje</span>
              </div>
              <div className="flex items-center gap-2 mt-1 opacity-70">
                <span className="w-3 h-3 rounded-full border border-zinc-400 flex items-center justify-center"><span className="w-1 h-1 bg-zinc-400 rounded-full"></span></span>
                <span className="text-[10px] text-zinc-400 italic">Tamaño = Volumen CO2e</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D - THEME: CYAN */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-cyan-900/40 shadow-xl overflow-hidden h-[450px] relative">
          <div className="absolute right-0 bottom-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-cyan-400 text-xs font-bold uppercase mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Matriz Evolutiva 3D</h3>
          <div className="h-full w-full cursor-move relative z-10">
            <Plot data={[{ type: 'scatter3d', mode: 'markers', x: trace3D.x, y: trace3D.y, z: trace3D.z, text: trace3D.text, hoverinfo: 'text', marker: { size: 6, color: trace3D.color, colorscale: 'PuBu', opacity: 0.8 } }, ...lines3D]} layout={layout3D} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true }} />
          </div>
        </div>
      </div>

      {/* FILA 2: EL GRÁFICO GERENCIAL TEMPORAL - THEME: CYAN */}
      <div className="bg-zinc-900/50 p-6 rounded-2xl border border-cyan-900/40 shadow-xl overflow-hidden h-[350px] relative">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-64 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-cyan-400 text-xs font-bold uppercase mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Flujo Neto Mensual (Emisiones vs Compensación)</h3>
        <div className="h-full w-full relative z-10">
          <Plot data={[{ type: 'bar', x: trendData.labels, y: trendData.emisiones, name: 'Emisiones Brutas (kg)', marker: { color: '#ef4444' } }, { type: 'bar', x: trendData.labels, y: trendData.compensaciones, name: 'Reciclaje / Mitigación (kg)', marker: { color: '#22c55e' } }]} layout={layoutTrend} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} />
        </div>
      </div>

      {/* FILA 3: SCOPES Y ACTIVIDADES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DONUT - THEME: ORANGE */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-orange-900/30 shadow-xl overflow-hidden h-[350px] relative">
          <div className="absolute left-0 bottom-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-orange-400 text-xs font-bold uppercase mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">Proporción por Scope</h3>
          <div className="h-full w-full relative z-10">
            <Plot data={[{ type: 'pie', hole: 0.6, labels: donutData.labels, values: donutData.values, marker: { colors: ['#eab308', '#f97316', '#ef4444'] }, hoverinfo: 'label+percent+value' }]} layout={layoutDonut} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} />
          </div>
        </div>
        
        {/* BARRAS - THEME: EMERALD */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-emerald-900/30 shadow-xl overflow-hidden h-[350px] relative">
          <div className="absolute right-0 bottom-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-emerald-400 text-xs font-bold uppercase mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">Impacto Absoluto por Actividad</h3>
          <div className="h-full w-full relative z-10">
            <Plot data={[{ type: 'bar', orientation: 'h', y: barData.labels, x: barData.values, hoverinfo: 'x+y', marker: { color: barData.values.map(v => v < 0 ? '#22c55e' : '#eab308') } }]} layout={layoutBar} useResizeHandler className="w-full h-full" style={{ width: "100%", height: "90%" }} config={{ responsive: true, displayModeBar: false }} />
          </div>
        </div>
      </div>

    </div>
  );
}