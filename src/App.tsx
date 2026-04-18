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
  Calendar as CalendarIcon
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

  const [activeTab, setActiveTab] = useState<"hoje" | "historico">("hoje");

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ponto Inteligente</h1>
            <div className="flex items-center gap-2 text-slate-500 mt-1">
              <CalendarIcon size={16} />
              <span className="capitalize">{format(currentTime, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
            </div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hora Atual</p>
              <p className="text-2xl font-mono font-bold text-slate-800">{format(currentTime, "HH:mm:ss")}</p>
            </div>
            <Clock className="text-blue-500" size={24} />
          </div>
        </header>

        <div className="flex w-full mb-8 bg-slate-200/50 p-1 rounded-2xl h-14">
          <button 
            onClick={() => setActiveTab("hoje")}
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center text-base font-medium transition-all",
              activeTab === "hoje" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Clock size={18} className="mr-2" />
            Hoje
          </button>
          <button 
            onClick={() => setActiveTab("historico")}
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center text-base font-medium transition-all",
              activeTab === "historico" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <History size={18} className="mr-2" />
            Histórico
          </button>
        </div>

        {activeTab === "hoje" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Controls */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Registro de Ponto</h2>
                    <p className="text-sm text-slate-500">Marque seus horários de hoje</p>
                  </div>
                  <button onClick={resetDay} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <RotateCcw size={18} />
                  </button>
                </div>
                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Entrada */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <LogIn size={16} className="text-emerald-500" />
                          Entrada
                        </label>
                        {!data.entrada && (
                          <button onClick={() => handleClockIn("entrada")} className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4">
                            Bater Agora
                          </button>
                        )}
                      </div>
                      <input 
                        type="time" 
                        value={data.entrada} 
                        onChange={(e) => handleTimeChange("entrada", e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    {/* Saída Almoço */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <Coffee size={16} className="text-orange-500" />
                          Saída Almoço
                        </label>
                        {!data.almocoSaida && (
                          <button onClick={() => handleClockIn("almocoSaida")} className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4">
                            Bater Agora
                          </button>
                        )}
                      </div>
                      <input 
                        type="time" 
                        value={data.almocoSaida} 
                        onChange={(e) => handleTimeChange("almocoSaida", e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>

                    {/* Retorno Almoço */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <RotateCcw size={16} className="text-blue-500" />
                          Retorno Almoço
                        </label>
                        {!data.almocoRetorno && (
                          <button onClick={() => handleClockIn("almocoRetorno")} className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4">
                            Bater Agora
                          </button>
                        )}
                      </div>
                      <input 
                        type="time" 
                        value={data.almocoRetorno} 
                        onChange={(e) => handleTimeChange("almocoRetorno", e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    {/* Saída Final */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <LogOut size={16} className="text-red-500" />
                          Saída Final
                        </label>
                        {!data.saida && (
                          <button onClick={() => handleClockIn("saida")} className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4">
                            Bater Agora
                          </button>
                        )}
                      </div>
                      <input 
                        type="time" 
                        value={data.saida} 
                        onChange={(e) => handleTimeChange("saida", e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Progress Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Progresso da Jornada (7h 20m)</p>
                        <p className="text-2xl font-bold text-slate-900">{stats.workedFormatted}</p>
                      </div>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                        stats.isOvertime ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {stats.isOvertime ? "Hora Extra" : "Jornada Normal"}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${stats.progress}%` }} />
                    </div>
                    
                    {stats.isOvertime && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex justify-between text-xs font-medium text-red-500 uppercase tracking-wider">
                          <span>Horas Extras</span>
                          <span>{stats.overtimeFormatted}</span>
                        </div>
                        <div className="h-2 w-full bg-red-50 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${stats.overtimeProgress}%` }} />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50/50 p-6 border-t border-slate-100">
                  <button 
                    className="w-full h-12 flex items-center justify-center text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    onClick={finalizeDay}
                    disabled={!data.entrada || !data.saida}
                  >
                    <Save size={18} className="mr-2" />
                    Finalizar Dia e Salvar no Histórico
                  </button>
                </div>
              </div>

              {/* Summary / Predictions */}
              <div className="space-y-6">
                <div className="bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 space-y-6">
                  <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <Timer size={20} className="text-blue-400" />
                      Previsões
                    </h3>
                    <p className="text-slate-400 text-sm">Horários limite para hoje</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Saída Ideal (7h 20m)</p>
                      <div className="flex items-center justify-between">
                        <p className="text-3xl font-mono font-bold text-blue-400">
                          {stats.finishTime8h ? format(stats.finishTime8h, "HH:mm") : "--:--"}
                        </p>
                        {stats.finishTime8h && isAfter(currentTime, stats.finishTime8h) && (
                          <CheckCircle2 className="text-emerald-500" size={24} />
                        )}
                      </div>
                    </div>

                    <hr className="border-slate-800" />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Limite Máximo (7h 20m + 2h)</p>
                      <div className="flex items-center justify-between">
                        <p className="text-3xl font-mono font-bold text-red-400">
                          {stats.finishTime10h ? format(stats.finishTime10h, "HH:mm") : "--:--"}
                        </p>
                        {stats.finishTime10h && isAfter(currentTime, stats.finishTime10h) && (
                          <AlertCircle className="text-red-500" size={24} />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        * Cálculo baseado na entrada e intervalo de almoço.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 -mx-6 -mb-6 p-4 rounded-b-3xl flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span>Monitoramento em tempo real</span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 space-y-4 border border-slate-100">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Resumo do Dia</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 text-sm">Tempo de Almoço</span>
                      <span className="font-semibold">{stats.lunchFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 text-sm">Horas Extras</span>
                      <span className={cn("font-semibold", stats.isOvertime ? "text-red-500" : "text-slate-400")}>
                        {stats.overtimeFormatted}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                      <span className="text-slate-900 font-medium">Total Trabalhado</span>
                      <span className="text-xl font-bold text-blue-600">{stats.workedFormatted}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Alert */}
            <AnimatePresence>
              {!data.entrada && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3"
                >
                  <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Comece seu dia!</p>
                    <p className="text-sm text-blue-700">Registre seu horário de entrada para começar a calcular sua jornada e previsões de saída.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold">Histórico de Batidas</h2>
                <p className="text-sm text-slate-500">Relatório de dias finalizados</p>
              </div>
              <div className="p-0">
                {history.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <History className="text-slate-300" size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">Nenhum registro encontrado.</p>
                    <p className="text-slate-400 text-sm">Finalize um dia para vê-lo aqui.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {history.map((item) => (
                      <div key={item.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-slate-800">
                              {format(parse(item.date, "yyyy-MM-dd", new Date()), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <LogIn size={14} className="text-emerald-500" /> {item.data.entrada}
                              </span>
                              <span className="flex items-center gap-1">
                                <Coffee size={14} className="text-orange-500" /> {item.data.almocoSaida} - {item.data.almocoRetorno}
                              </span>
                              <span className="flex items-center gap-1">
                                <LogOut size={14} className="text-red-500" /> {item.data.saida}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p>
                              <p className="text-xl font-bold text-blue-600">{item.workedFormatted}</p>
                            </div>
                            {item.isOvertime && (
                              <div className="text-right">
                                <p className="text-xs font-medium text-red-400 uppercase tracking-wider">Extra</p>
                                <p className="text-xl font-bold text-red-500">{item.overtimeFormatted}</p>
                              </div>
                            )}
                            <button 
                              onClick={() => deleteHistoryItem(item.id)}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

