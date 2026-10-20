/**
 * Medidor de desempenho do Coverly. Fica desligado por padrão e guarda tudo
 * só na memória: nada é gravado em disco nem enviado para fora. Desligado, as
 * funções abaixo apenas chamam o que receberam.
 */

/** Amostras recentes de cada medida, para calcular o p95. */
const MAX_SAMPLES = 200;
/** Tarefas longas guardadas (as mais recentes). */
const MAX_LONG_TASKS = 50;
const P95 = 0.95;

interface Metric {
  count: number;
  max: number;
  samples: number[];
  total: number;
}

export interface MetricSummary {
  count: number;
  max: number;
  mean: number;
  name: string;
  p95: number;
  total: number;
}

export interface LongTask {
  /** Milissegundos desde o carregamento da página. */
  at: number;
  duration: number;
}

export interface PerfSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, string>;
  longTasks: LongTask[];
  metrics: MetricSummary[];
}

const metrics = new Map<string, Metric>();
const counters = new Map<string, number>();
const gauges = new Map<string, () => number | string>();
let longTasks: LongTask[] = [];
let observer: PerformanceObserver | null = null;
let enabled = false;

const record = (name: string, duration: number): void => {
  let metric = metrics.get(name);
  if (!metric) {
    metric = { count: 0, max: 0, samples: [], total: 0 };
    metrics.set(name, metric);
  }
  metric.count += 1;
  metric.total += duration;
  metric.max = Math.max(metric.max, duration);
  metric.samples.push(duration);
  if (metric.samples.length > MAX_SAMPLES) {
    metric.samples.shift();
  }
};

const startLongTasks = (): void => {
  if (observer || typeof PerformanceObserver === "undefined") {
    return;
  }
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ at: entry.startTime, duration: entry.duration });
      }
      longTasks = longTasks.slice(-MAX_LONG_TASKS);
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // Esta versão do Obsidian não expõe tarefas longas.
    observer = null;
  }
};

export const isPerfEnabled = (): boolean => enabled;

export const setPerfEnabled = (value: boolean): void => {
  enabled = value;
  if (value) {
    startLongTasks();
    return;
  }
  observer?.disconnect();
  observer = null;
};

/** Mede `work` sob `name`. Desligado, só o executa. */
export const measure = <T>(name: string, work: () => T): T => {
  if (!enabled) {
    return work();
  }
  const start = performance.now();
  try {
    return work();
  } finally {
    record(name, performance.now() - start);
  }
};

/** Como `measure`, para trabalho assíncrono (conta também o tempo esperando). */
export const measureAsync = async <T>(
  name: string,
  work: () => Promise<T>
): Promise<T> => {
  if (!enabled) {
    return await work();
  }
  const start = performance.now();
  try {
    return await work();
  } finally {
    record(name, performance.now() - start);
  }
};

/** Registra uma duração já medida por quem chama (ex.: o `onload`). */
export const recordDuration = (name: string, duration: number): void => {
  if (enabled) {
    record(name, duration);
  }
};

/** Conta um acontecimento (ex.: redesenho do cabeçalho). */
export const count = (name: string): void => {
  if (enabled) {
    counters.set(name, (counters.get(name) ?? 0) + 1);
  }
};

/** Valor lido só quando o relatório é aberto (tamanho de cache, fila…). */
export const registerGauge = (
  name: string,
  read: () => number | string
): void => {
  gauges.set(name, read);
};

const percentile = (samples: number[], fraction: number): number => {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction)
  );
  return sorted[index] ?? 0;
};

const readGauge = (read: () => number | string): string => {
  try {
    return String(read());
  } catch {
    return "–";
  }
};

export const perfSnapshot = (): PerfSnapshot => ({
  counters: Object.fromEntries(counters),
  gauges: Object.fromEntries(
    [...gauges].map(([name, read]) => [name, readGauge(read)])
  ),
  longTasks: [...longTasks],
  metrics: [...metrics]
    .map(([name, metric]) => ({
      count: metric.count,
      max: metric.max,
      mean: metric.total / metric.count,
      name,
      p95: percentile(metric.samples, P95),
      total: metric.total,
    }))
    .toSorted((a, b) => b.total - a.total),
});

export const resetPerf = (): void => {
  metrics.clear();
  counters.clear();
  longTasks = [];
};
