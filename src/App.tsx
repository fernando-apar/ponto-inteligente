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
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type TimePoint = "entrada" | "almocoSaida" | "almocoRetorno" | "saida";

interface PontoData {
  entrada: string;
  almocoSaida: string;
  almocoRetorno: string;
  saida: string;
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

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("ponto_diario", JSON.stringify(data));
  }, [data]);

  const handleTimeChange = (point: TimePoint, value: string) => {
    setData((prev) => ({ ...prev, [point]: value }));
  };

  const handleClockIn = (point: TimePoint) => {
    const now = format(new Date(), "HH:mm");
    handleTimeChange(point, now);
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
    const standardWorkMinutes = 8 * 60; // 8 hours
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Controls */}
          <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registro de Ponto</CardTitle>
                  <CardDescription>Marque seus horários de hoje</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={resetDay} className="text-slate-400 hover:text-red-500 hover:bg-red-50">
                  <RotateCcw size={18} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Entrada */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-slate-600">
                      <LogIn size={16} className="text-emerald-500" />
                      Entrada
                    </Label>
                    {!data.entrada && (
                      <Button size="sm" variant="outline" onClick={() => handleClockIn("entrada")} className="h-8 px-3 text-xs">
                        Bater Agora
                      </Button>
                    )}
                  </div>
                  <Input 
                    type="time" 
                    value={data.entrada} 
                    onChange={(e) => handleTimeChange("entrada", e.target.value)}
                    className="h-12 text-lg font-mono focus-visible:ring-emerald-500"
                  />
                </div>

                {/* Saída Almoço */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-slate-600">
                      <Coffee size={16} className="text-orange-500" />
                      Saída Almoço
                    </Label>
                    {!data.almocoSaida && (
                      <Button size="sm" variant="outline" onClick={() => handleClockIn("almocoSaida")} className="h-8 px-3 text-xs">
                        Bater Agora
                      </Button>
                    )}
                  </div>
                  <Input 
                    type="time" 
                    value={data.almocoSaida} 
                    onChange={(e) => handleTimeChange("almocoSaida", e.target.value)}
                    className="h-12 text-lg font-mono focus-visible:ring-orange-500"
                  />
                </div>

                {/* Retorno Almoço */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-slate-600">
                      <RotateCcw size={16} className="text-blue-500" />
                      Retorno Almoço
                    </Label>
                    {!data.almocoRetorno && (
                      <Button size="sm" variant="outline" onClick={() => handleClockIn("almocoRetorno")} className="h-8 px-3 text-xs">
                        Bater Agora
                      </Button>
                    )}
                  </div>
                  <Input 
                    type="time" 
                    value={data.almocoRetorno} 
                    onChange={(e) => handleTimeChange("almocoRetorno", e.target.value)}
                    className="h-12 text-lg font-mono focus-visible:ring-blue-500"
                  />
                </div>

                {/* Saída Final */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-slate-600">
                      <LogOut size={16} className="text-red-500" />
                      Saída Final
                    </Label>
                    {!data.saida && (
                      <Button size="sm" variant="outline" onClick={() => handleClockIn("saida")} className="h-8 px-3 text-xs">
                        Bater Agora
                      </Button>
                    )}
                  </div>
                  <Input 
                    type="time" 
                    value={data.saida} 
                    onChange={(e) => handleTimeChange("saida", e.target.value)}
                    className="h-12 text-lg font-mono focus-visible:ring-red-500"
                  />
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Progress Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">Progresso da Jornada (8h)</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.workedFormatted}</p>
                  </div>
                  <Badge variant={stats.isOvertime ? "destructive" : "secondary"} className="mb-1">
                    {stats.isOvertime ? "Hora Extra" : "Jornada Normal"}
                  </Badge>
                </div>
                <Progress value={stats.progress} className="h-3 bg-slate-100" />
                
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
                    <Progress value={stats.overtimeProgress} className="h-2 bg-red-50" />
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary / Predictions */}
          <div className="space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-slate-900 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Timer size={20} className="text-blue-400" />
                  Previsões
                </CardTitle>
                <CardDescription className="text-slate-400">Horários limite para hoje</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Saída Ideal (8h)</p>
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-mono font-bold text-blue-400">
                      {stats.finishTime8h ? format(stats.finishTime8h, "HH:mm") : "--:--"}
                    </p>
                    {stats.finishTime8h && isAfter(currentTime, stats.finishTime8h) && (
                      <CheckCircle2 className="text-emerald-500" size={24} />
                    )}
                  </div>
                </div>

                <Separator className="bg-slate-800" />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Limite Máximo (8h + 2h)</p>
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
              </CardContent>
              <CardFooter className="bg-slate-800/50 p-4 rounded-b-xl">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Monitoramento em tempo real</span>
                </div>
              </CardFooter>
            </Card>

            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Resumo do Dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Tempo de Almoço</span>
                  <span className="font-semibold">{stats.lunchFormatted}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Horas Extras</span>
                  <span className={cn("font-semibold", stats.isOvertime ? "text-red-500" : "text-slate-400")}>
                    {stats.overtimeFormatted}
                  </span >
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-slate-900 font-medium">Total Trabalhado</span>
                  <span className="text-xl font-bold text-blue-600">{stats.workedFormatted}</span>
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
}

