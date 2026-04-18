/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { 
  Clock, 
  Coffee, 
  LogIn, 
  LogOut, 
  RotateCcw, 
  AlertCircle,
  CheckCircle2,
  Timer,
  History,
  Save,
  Trash2,
  Calendar as CalendarIcon,
  ChevronRight,
  TrendingUp,
  Award
} from "lucide-react";
import { 
  format, 
  differenceInMinutes, 
  addMinutes, 
  parse, 
  isValid,
  startOfToday,
  isAfter
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

type TimePoint = "entrada" | "almocoSaida" | "almocoRetorno" | "saida";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

interface PontoData {
  entrada: string;
  almocoSaida: string;
  almocoRetorno: string;
  saida: string;
}

interface HistoryItem {
  id: string;
  date: string;
  data: PontoData;
  workedFormatted: string;
  overtimeFormatted: string;
  isOvertime: boolean;
}

const INITIAL_DATA: PontoData = {
  entrada: "",
  almocoSaida: "",
  almocoRetorno: "",
  saida: "",
};

export default function App() {
  const [data, setData] = useState<PontoData>(() => {
    const saved = localStorage.getItem("ponto_diario");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem("ponto_historico");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"hoje" | "historico">("hoje");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("ponto_diario", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("ponto_historico", JSON.stringify(history));
  }, [history]);

  const handleTimeChange = (point: TimePoint, value: string) => {
    setData((prev) => ({ ...prev, [point]: value }));
  };

  const handleClockIn = (point: TimePoint) => {
    const now = format(new Date(), "HH:mm");
    handleTimeChange(point, now);
  };

  const finalizeDay = () => {
    if (!data.entrada || !data.saida) {
      alert("Por favor, registre pelo menos a entrada e a saída final antes de finalizar.");
      return;
    }

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      date: format(new Date(), "yyyy-MM-dd"),
      data: { ...data },
      workedFormatted: stats.workedFormatted,
      overtimeFormatted: stats.overtimeFormatted,
      isOvertime: stats.isOvertime,
    };

    setHistory((prev) => [newItem, ...prev]);
    setData(INITIAL_DATA);
    alert("Dia finalizado e salvo no histórico!");
  };

  const deleteHistoryItem = (id: string) => {
    if (confirm("Deseja excluir este registro do histórico?")) {
      setHistory((prev) => prev.filter(item => item.id !== id));
    }
  };

  const resetDay = () => {
    if (confirm("Tem certeza que deseja limpar os dados de hoje?")) {
      setData(INITIAL_DATA);
    }
  };

  const stats = useMemo(() => {
    const today = startOfToday();
    const parseTime = (timeStr: string) => {
      if (!timeStr) return null;
      const parsed = parse(timeStr, "HH:mm", today);
      return isValid(parsed) ? parsed : null;
    };

    const tEntrada = parseTime(data.entrada);
    const tAlmocoSaida = parseTime(data.almocoSaida);
    const tAlmocoRetorno = parseTime(data.almocoRetorno);
    const tSaida = parseTime(data.saida);

    let workedMinutes = 0;
    let lunchMinutes = 0;

    // Period 1: Entrada -> Almoco Saida
    if (tEntrada && tAlmocoSaida) {
      workedMinutes += differenceInMinutes(tAlmocoSaida, tEntrada);
    } else if (tEntrada && !tAlmocoSaida) {
      workedMinutes += differenceInMinutes(currentTime, tEntrada);
    }

    // Lunch Period
    if (tAlmocoSaida && tAlmocoRetorno) {
      lunchMinutes = differenceInMinutes(tAlmocoRetorno, tAlmocoSaida);
    }

    // Period 2: Almoco Retorno -> Saida
    if (tAlmocoRetorno && tSaida) {
      workedMinutes += differenceInMinutes(tSaida, tAlmocoRetorno);
    } else if (tAlmocoRetorno && !tSaida) {
      workedMinutes += differenceInMinutes(currentTime, tAlmocoRetorno);
    }

    const formatDuration = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m.toString().padStart(2, "0")}m`;
    };

    // Calculations for limit times
    const standardWorkMinutes = 7 * 60 + 20; // 7h 20m = 440 minutes
    const maxOvertimeMinutes = 2 * 60; // 2 hours
    const totalLimitMinutes = standardWorkMinutes + maxOvertimeMinutes;

    let finishTime8h = null;
    let finishTime10h = null;

    if (tEntrada) {
      // If we have lunch info, we can be precise
      if (tAlmocoSaida && tAlmocoRetorno) {
        const totalBreak = differenceInMinutes(tAlmocoRetorno, tAlmocoSaida);
        finishTime8h = addMinutes(tEntrada, standardWorkMinutes + totalBreak);
        finishTime10h = addMinutes(tEntrada, totalLimitMinutes + totalBreak);
      } else {
        // Estimate with 1h lunch if not started lunch yet
        const estimatedLunch = 60;
        finishTime8h = addMinutes(tEntrada, standardWorkMinutes + estimatedLunch);
        finishTime10h = addMinutes(tEntrada, totalLimitMinutes + estimatedLunch);
      }
    }

    const progress = Math.min((workedMinutes / standardWorkMinutes) * 100, 100);
    const overtimeProgress = Math.max(0, Math.min(((workedMinutes - standardWorkMinutes) / maxOvertimeMinutes) * 100, 100));

    return {
      workedMinutes,
      lunchMinutes,
      workedFormatted: formatDuration(workedMinutes),
      lunchFormatted: formatDuration(lunchMinutes),
      finishTime8h,
      finishTime10h,
      progress,
      overtimeProgress,
      isOvertime: workedMinutes > standardWorkMinutes,
      overtimeMinutes: Math.max(0, workedMinutes - standardWorkMinutes),
      overtimeFormatted: formatDuration(Math.max(0, workedMinutes - standardWorkMinutes))
    };
  }, [data, currentTime]);

  return (
    <div className="min-h-screen bg-[#0F172A] selection:bg-red-500/30 selection:text-white text-slate-200 font-sans relative overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase italic">Ponto Inteligente</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-1 font-medium">
                <CalendarIcon size={14} />
                <span className="capitalize text-sm">{format(currentTime, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-3xl flex items-center gap-6 shadow-2xl">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Hora em Tempo Real</p>
              <p className="text-3xl font-mono font-black text-white tracking-widest">{format(currentTime, "HH:mm:ss")}</p>
            </div>
            <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20">
              <Clock className="text-white" size={24} />
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-center mb-10">
          <div className="bg-white/5 backdrop-blur-md p-1.5 rounded-[2rem] border border-white/10 flex gap-1 w-full max-w-sm">
            <button 
              onClick={() => setActiveTab("hoje")}
              className={cn(
                "flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300",
                activeTab === "hoje" ? "bg-red-600 text-white shadow-xl shadow-red-600/20" : "text-slate-400 hover:text-white"
              )}
            >
              <Clock size={16} />
              HOJE
            </button>
            <button 
              onClick={() => setActiveTab("historico")}
              className={cn(
                "flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300",
                activeTab === "historico" ? "bg-red-600 text-white shadow-xl shadow-red-600/20" : "text-slate-400 hover:text-white"
              )}
            >
              <History size={16} />
              HISTÓRICO
            </button>
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {activeTab === "hoje" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Controls Card */}
              <motion.div variants={itemVariants} className="lg:col-span-8 group">
                <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-2xl">
                        <Save className="text-red-500" size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Registro Diário</h2>
                        <p className="text-sm text-slate-400">Jornada padrão: 7h 20m</p>
                      </div>
                    </div>
                    <button 
                      onClick={resetDay} 
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all active:scale-95"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>

                  <div className="p-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Entry Points Grid */}
                      {[
                        { id: "entrada", label: "entrada", icon: LogIn, color: "emerald" },
                        { id: "almocoSaida", label: "saída almoço", icon: Coffee, color: "orange" },
                        { id: "almocoRetorno", label: "retorno almoço", icon: RotateCcw, color: "blue" },
                        { id: "saida", label: "saída final", icon: LogOut, color: "red" },
                      ].map((item) => (
                        <div key={item.id} className="space-y-4 group/input">
                          <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-3 text-xs font-black text-slate-500 uppercase tracking-widest group-focus-within/input:text-white transition-colors">
                              <item.icon size={16} className={cn(`text-${item.color}-500`)} />
                              {item.label}
                            </label>
                            {!(data as any)[item.id] && (
                              <button 
                                onClick={() => handleClockIn(item.id as TimePoint)} 
                                className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                              >
                                AGORA <ChevronRight size={10} />
                              </button>
                            )}
                          </div>
                          <div className="relative group/field">
                            <input 
                              type="time" 
                              value={(data as any)[item.id]} 
                              onChange={(e) => handleTimeChange(item.id as TimePoint, e.target.value)}
                              className={cn(
                                "w-full h-16 px-6 bg-white/5 rounded-3xl border border-white/5 text-xl font-mono font-bold text-white transition-all outline-none",
                                "focus:bg-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/5 hover:bg-white/10"
                              )}
                            />
                            <div className={cn(
                              "absolute bottom-0 left-6 right-6 h-[2px] rounded-full scale-x-0 group-focus-within/field:scale-x-100 transition-transform origin-left duration-500",
                              `bg-${item.color}-500 shadow-[0_0_12px_rgba(var(--${item.color}-500),0.5)]`
                            )} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-[1px] bg-white/5" />

                    {/* Progress Visualizer */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-red-500 font-bold">
                            <TrendingUp size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo de Trabalho</p>
                            <p className="text-3xl font-mono font-black text-white">{stats.workedFormatted}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse",
                          stats.isOvertime ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        )}>
                          {stats.isOvertime ? "HORA EXTRA" : "JORNADA NORMAL"}
                        </div>
                      </div>
                      
                      <div className="relative h-6 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        />
                      </div>
                      
                      {stats.isOvertime && (
                        <AnimatePresence>
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="pt-4 space-y-3"
                          >
                            <div className="flex justify-between text-[10px] font-black text-red-500 uppercase tracking-widest">
                              <span className="flex items-center gap-2 px-1">
                                <AlertCircle size={12} /> ALERTA DE EXTRA:
                              </span>
                              <span>{stats.overtimeFormatted}</span>
                            </div>
                            <div className="h-2 w-full bg-red-900/20 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.overtimeProgress}%` }}
                                className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                              />
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  </div>

                  <div className="p-8 bg-white/[0.02] border-t border-white/5">
                    <button 
                      onClick={finalizeDay}
                      disabled={!data.entrada || !data.saida}
                      className="w-full h-20 group/btn relative overflow-hidden flex items-center justify-center gap-3 text-lg font-black uppercase tracking-[0.2em] bg-white text-slate-900 rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-white to-slate-200 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      <Save size={24} className="relative z-10" />
                      <span className="relative z-10">Finalizar Jornada</span>
                    </button>
                    <p className="text-center text-[10px] text-slate-500 mt-6 font-bold tracking-[0.1em]">
                      OS DADOS SERÃO ARQUIVADOS PERMANENTEMENTE NO SEU HISTÓRICO LOCAL.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Predictions & Stats Cards */}
              <div className="lg:col-span-4 space-y-8">
                <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-1 shadow-2xl">
                  <div className="bg-slate-900 rounded-[2.4rem] p-8 space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Timer size={120} />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-2 text-lg font-black text-white uppercase italic">
                        <Timer size={20} className="text-red-500" />
                        PREVISÕES
                      </h3>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Baseado nos registros atuais</p>
                    </div>
                    
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saída Ideal (7h 20m)</p>
                        <div className="flex items-center justify-between">
                          <p className="text-4xl font-mono font-black text-white">
                            {stats.finishTime8h ? format(stats.finishTime8h, "HH:mm") : "--:--"}
                          </p>
                          {stats.finishTime8h && isAfter(currentTime, stats.finishTime8h) && (
                            <div className="h-10 w-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="text-emerald-500" size={20} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="h-[1px] bg-white/5" />

                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest">Limite Crítico (+2h)</p>
                        <div className="flex items-center justify-between">
                          <p className="text-4xl font-mono font-black text-red-500">
                            {stats.finishTime10h ? format(stats.finishTime10h, "HH:mm") : "--:--"}
                          </p>
                          {stats.finishTime10h && isAfter(currentTime, stats.finishTime10h) && (
                            <div className="h-10 w-10 bg-red-500/20 rounded-full flex items-center justify-center animate-bounce">
                              <AlertCircle className="text-red-500" size={20} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/5 -mx-8 -mb-8 p-6 flex items-center gap-4 border-t border-white/5">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-6 w-6 rounded-full bg-slate-800 border-2 border-slate-900" />
                        ))}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acompanhando...</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-8 space-y-6 shadow-2xl">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Métricas do Dia</h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Coffee className="text-orange-500" size={16} />
                        <span className="text-xs font-black uppercase text-slate-400">Pausa Almoço</span>
                      </div>
                      <span className="font-mono font-bold text-lg">{stats.lunchFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Award className="text-red-500" size={16} />
                        <span className="text-xs font-black uppercase text-slate-400">Total Extras</span>
                      </div>
                      <span className={cn("font-mono font-bold text-lg", stats.isOvertime ? "text-red-500" : "text-slate-500")}>
                        {stats.overtimeFormatted}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          ) : (
            <motion.div variants={itemVariants} className="max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                <div className="p-10 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-red-600/10 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-red-600/20 rounded-3xl">
                      <History className="text-red-500" size={28} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Relatórios</h2>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Registro permanente de atividades</p>
                    </div>
                  </div>
                </div>
                
                <div className="min-h-[400px]">
                  {history.length === 0 ? (
                    <div className="py-32 text-center animate-pulse">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/5">
                        <History className="text-slate-700" size={40} />
                      </div>
                      <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">Base de dados vazia</p>
                      <p className="text-slate-700 text-xs mt-2 uppercase font-bold">Finalize um turno para gerar registros.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {history.map((item, idx) => (
                        <motion.div 
                          key={item.id} 
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-8 hover:bg-white/[0.03] transition-all group/item"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <p className="text-2xl font-black text-white italic capitalize">
                                  {format(parse(item.date, "yyyy-MM-dd", new Date()), "dd 'de' MMMM", { locale: ptBR })}
                                </p>
                                {item.isOvertime && (
                                  <span className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md">
                                    EXTRA
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-6">
                                <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-xl border border-white/5">
                                  <LogIn size={12} className="text-emerald-500" /> 
                                  <span className="text-xs font-mono font-bold text-slate-300">{item.data.entrada}</span>
                                </div>
                                <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-xl border border-white/5">
                                  <Coffee size={12} className="text-orange-500" /> 
                                  <span className="text-xs font-mono font-bold text-slate-300">{item.data.almocoSaida} — {item.data.almocoRetorno}</span>
                                </div>
                                <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-xl border border-white/5">
                                  <LogOut size={12} className="text-red-500" /> 
                                  <span className="text-xs font-mono font-bold text-slate-300">{item.data.saida || "--:--"}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-10">
                              <div className="flex gap-10">
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Total</p>
                                  <p className="text-2xl font-mono font-black text-white">{item.workedFormatted}</p>
                                </div>
                                {item.isOvertime && (
                                  <div className="text-right">
                                    <p className="text-[10px] font-black text-red-500/50 uppercase tracking-widest mb-1">Extra</p>
                                    <p className="text-2xl font-mono font-black text-red-500">{item.overtimeFormatted}</p>
                                  </div>
                                )}
                              </div>
                              <div className="h-10 w-[1px] bg-white/10 hidden md:block" />
                              <button 
                                onClick={() => deleteHistoryItem(item.id)}
                                className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all opacity-0 group-hover/item:opacity-100 scale-90 group-hover/item:scale-100"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer Brand */}
        <footer className="mt-20 pb-10 text-center space-y-4">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">Ponto Inteligente — v2.0</p>
        </footer>
      </div>
    </div>
  );
}

