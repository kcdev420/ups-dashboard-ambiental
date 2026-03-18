import clientPromise from "../lib/mongodb";
import DashboardClient from "./DashboardClient";

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const client = await clientPromise;
    const db = client.db("carbono");

    const rawData = (await db.collection("raw").find({}).toArray()).map(doc => ({
      ...doc,
      _id: doc._id.toString()
    }));

    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
        
        {/* ENCABEZADO RESPONSIVE */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-zinc-800 pb-6 mb-8 relative">
          <div className="absolute left-0 top-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">UPS HEALTHCARE</h1>
            <p className="text-zinc-400 text-sm italic mt-1">Plataforma de Huella Ambiental</p>
          </div>
          <div className="flex gap-4 relative z-10 self-start sm:self-center">
            <span className="bg-green-500/10 text-green-500 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              API & ATLAS CONNECTED
            </span>
          </div>
        </header>

        {/* AQUÍ INYECTAMOS TODO EL DASHBOARD (SIN DUPLICAR) */}
        <DashboardClient rawData={rawData} />

        {/* FOOTER PROFESIONAL DE CRÉDITOS */}
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